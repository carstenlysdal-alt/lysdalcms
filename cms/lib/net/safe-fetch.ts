/**
 * Sikker hentning af eksterne adresser (feeds og kilder, redaktøren selv har angivet). Følger S1-S14 og S17 i
 * docs/localrating/10-feeds-rettigheder-og-ssrf.md:
 *  - kun http(s) på port 80/443, ingen brugeroplysninger, ingen interne værtsnavne, alle IP-formater normaliseres
 *  - ALLE DNS-svar valideres, og forbindelsen sker til den validerede adresse (pinning, lukker DNS-rebinding)
 *  - redirects følges manuelt (højst 5) og gennemgår samme tjek hver gang; ingen nedgradering fra https til http
 *  - størrelsesloft på både overførte og udpakkede bytes, samlet tidsloft, Content-Type-liste
 *  - ingen cookies og ingen videresendte credentials; ærligt User-Agent
 * Fejl gengiver aldrig interne adresser eller svar: kun en kode og en kort tekst.
 */
import dns from "node:dns";
import http from "node:http";
import https from "node:https";
import { isIP } from "node:net";
import zlib from "node:zlib";
import { checkUrlShape, hostAllowed, isBlockedIp } from "./ip-guard";

export type FetchFailure = "ugyldig_url" | "blokeret" | "for_stor" | "timeout" | "indholdstype" | "http_fejl" | "omdirigeringer" | "netvaerk" | "robots";
export type SafeFetchResult =
  | { ok: true; url: string; status: number; contentType: string; /** Tegnsæt fra Content-Type, hvis angivet. */ charset: string | null; body: Buffer }
  | { ok: false; code: FetchFailure; message: string; status?: number };

export type SafeFetchOptions = {
  maxBytes?: number;
  timeoutMs?: number;
  accept?: string;
  /** Tilladte Content-Type-forløb (små bogstaver, uden parametre). */
  contentTypes?: readonly RegExp[];
  maxRedirects?: number;
};

export type LookupFn = (hostname: string) => Promise<Array<{ address: string; family: number }>>;
export type SafeFetchDeps = { lookup?: LookupFn };

export const FEED_CONTENT_TYPES: readonly RegExp[] = [/^application\/(rss|atom)\+xml$/, /^application\/xml$/, /^text\/xml$/, /^application\/(feed\+)?json$/, /^text\/plain$/, /^text\/html$/];
export const PAGE_CONTENT_TYPES: readonly RegExp[] = [/^text\/html$/, /^application\/xhtml\+xml$/, /^text\/plain$/];
export const PDF_CONTENT_TYPES: readonly RegExp[] = [/^application\/pdf$/];

export const DEFAULTS = { maxBytes: 5 * 1024 * 1024, timeoutMs: 15_000, connectMs: 5_000, maxRedirects: 5 } as const;

export function userAgent(env: NodeJS.ProcessEnv = process.env): string {
  return env.FEED_USER_AGENT?.trim() || "LokalCMS/1.0 (redaktionel kildehentning; kontakt via sitets redaktion)";
}

/**
 * KUN til test og lokal udvikling mod en mock-server på egen maskine: komma-adskilte porte, hvor loopback (127.0.0.1/::1) må nås.
 * Alle andre interne adresser og porte er stadig lukkede. Må aldrig sættes i drift; tom som standard.
 */
const loopbackPorts = (env: NodeJS.ProcessEnv = process.env) =>
  (env.FEED_FETCH_LOOPBACK_PORTS ?? "").split(",").map((p) => Number(p.trim())).filter((n) => Number.isInteger(n) && n > 0 && n < 65536);
const extraPorts = loopbackPorts;
const isLoopback = (ip: string) => ip === "::1" || ip === "127.0.0.1" || /^127\./.test(ip);
const blockedFor = (ip: string, port: number) => isBlockedIp(ip) && !(isLoopback(ip) && loopbackPorts().includes(port));
const hostSuffixes = (env: NodeJS.ProcessEnv = process.env) => (env.LOCALRATING_FEED_HOST_ALLOWLIST ?? "").split(",").map((s) => s.trim()).filter(Boolean);

const defaultLookup: LookupFn = async (hostname) => dns.promises.lookup(hostname, { all: true, verbatim: true });

const fail = (code: FetchFailure, message: string, status?: number): SafeFetchResult => ({ ok: false, code, message, ...(status ? { status } : {}) });

/** S6: slå alle adresser op og afvis, hvis NOGEN er blokeret. Returnerer de validerede adresser. */
async function resolvePublic(hostname: string, literalIp: string | null, port: number, lookup: LookupFn): Promise<Array<{ address: string; family: number }> | SafeFetchResult> {
  if (literalIp) {
    if (blockedFor(literalIp, port)) return fail("blokeret", "Adressen er ikke tilladt.");
    return [{ address: literalIp, family: isIP(literalIp) }];
  }
  let addrs: Array<{ address: string; family: number }>;
  try {
    addrs = await lookup(hostname);
  } catch {
    return fail("netvaerk", "Værten kunne ikke findes.");
  }
  if (addrs.length === 0) return fail("netvaerk", "Værten kunne ikke findes.");
  if (addrs.some((a) => blockedFor(a.address, port))) return fail("blokeret", "Adressen er ikke tilladt.");
  return addrs;
}

type Hop = { status: number; headers: http.IncomingHttpHeaders; body: Buffer | null; location: string | null };

function requestOnce(url: URL, pinned: { address: string; family: number }, opts: Required<Pick<SafeFetchOptions, "maxBytes" | "accept">> & { contentTypes: readonly RegExp[]; deadline: number }): Promise<Hop | SafeFetchResult> {
  return new Promise((resolve) => {
    const secure = url.protocol === "https:";
    const lib = secure ? https : http;
    const remaining = Math.max(1, opts.deadline - Date.now());
    let settled = false;
    const done = (v: Hop | SafeFetchResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(v);
    };
    const req = lib.request(
      {
        protocol: url.protocol,
        hostname: url.hostname.replace(/^\[|\]$/g, ""),
        port: url.port ? Number(url.port) : secure ? 443 : 80,
        path: `${url.pathname}${url.search}`,
        method: "GET",
        // S7: forbindelsen sker til den validerede adresse; intet nyt DNS-opslag mellem tjek og forbindelse.
        lookup: ((_host: string, options: { all?: boolean }, cb: (...args: unknown[]) => void) => {
          if (options && options.all) cb(null, [{ address: pinned.address, family: pinned.family }]);
          else cb(null, pinned.address, pinned.family);
        }) as never,
        headers: { "User-Agent": userAgent(), Accept: opts.accept, "Accept-Encoding": "gzip, deflate", "Accept-Language": "da,en;q=0.7", Connection: "close" },
        ...(secure ? { servername: isIP(url.hostname.replace(/^\[|\]$/g, "")) ? undefined : url.hostname } : {}),
      },
      (res) => {
        const status = res.statusCode ?? 0;
        const location = typeof res.headers.location === "string" ? res.headers.location : null;
        if (status >= 300 && status < 400 && location) {
          res.resume();
          return done({ status, headers: res.headers, body: null, location });
        }
        if (status < 200 || status >= 300) {
          res.resume();
          return done(fail("http_fejl", `Kilden svarede med fejlkode ${status}.`, status));
        }
        const type = String(res.headers["content-type"] ?? "").split(";")[0].trim().toLowerCase();
        if (!opts.contentTypes.some((re) => re.test(type))) {
          res.resume();
          return done(fail("indholdstype", "Kilden leverer en type, der ikke kan bruges her."));
        }
        const length = Number(res.headers["content-length"]);
        if (Number.isFinite(length) && length > opts.maxBytes) {
          res.resume();
          return done(fail("for_stor", "Svaret er for stort."));
        }
        const chunks: Buffer[] = [];
        let size = 0;
        res.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > opts.maxBytes) {
            req.destroy();
            return done(fail("for_stor", "Svaret er for stort."));
          }
          chunks.push(chunk);
        });
        res.on("error", () => done(fail("netvaerk", "Forbindelsen blev afbrudt.")));
        res.on("end", () => {
          const raw = Buffer.concat(chunks);
          const enc = String(res.headers["content-encoding"] ?? "").toLowerCase();
          try {
            let body = raw;
            if (enc === "gzip" || enc === "x-gzip") body = zlib.gunzipSync(raw, { maxOutputLength: opts.maxBytes });
            else if (enc === "deflate") body = zlib.inflateSync(raw, { maxOutputLength: opts.maxBytes });
            else if (enc && enc !== "identity") return done(fail("indholdstype", "Kilden bruger en komprimering, der ikke understøttes."));
            done({ status, headers: res.headers, body, location: null });
          } catch {
            done(fail("for_stor", "Svaret kunne ikke pakkes ud inden for grænsen."));
          }
        });
      },
    );
    const timer = setTimeout(() => {
      req.destroy();
      done(fail("timeout", "Kilden svarede for langsomt."));
    }, remaining);
    req.setTimeout(DEFAULTS.connectMs, () => {
      req.destroy();
      done(fail("timeout", "Kilden svarede for langsomt."));
    });
    req.on("error", () => done(fail("netvaerk", "Kilden kunne ikke nås.")));
    req.end();
  });
}

const isResult = (v: Hop | SafeFetchResult): v is SafeFetchResult => "ok" in v;

export async function safeFetch(rawUrl: string, options: SafeFetchOptions = {}, deps: SafeFetchDeps = {}): Promise<SafeFetchResult> {
  const opts = {
    maxBytes: options.maxBytes ?? DEFAULTS.maxBytes,
    accept: options.accept ?? "application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.9, text/html;q=0.7, */*;q=0.1",
    contentTypes: options.contentTypes ?? FEED_CONTENT_TYPES,
    deadline: Date.now() + (options.timeoutMs ?? DEFAULTS.timeoutMs),
  };
  const maxRedirects = options.maxRedirects ?? DEFAULTS.maxRedirects;
  const lookup = deps.lookup ?? defaultLookup;
  let current = rawUrl;
  let previousSecure: boolean | null = null;

  for (let hop = 0; hop <= maxRedirects; hop++) {
    const shape = checkUrlShape(current, { extraPorts: extraPorts() });
    if (!shape.ok) return fail(hop === 0 ? "ugyldig_url" : "blokeret", shape.message);
    if (previousSecure === true && shape.url.protocol === "http:") return fail("blokeret", "Kilden forsøgte at skifte fra https til http.");
    if (!hostAllowed(shape.hostname, hostSuffixes())) return fail("blokeret", "Værten er ikke på listen over tilladte kilder.");
    const port = shape.url.port ? Number(shape.url.port) : shape.url.protocol === "https:" ? 443 : 80;
    const addrs = await resolvePublic(shape.hostname, shape.literalIp, port, lookup);
    if (!Array.isArray(addrs)) return addrs;
    const res = await requestOnce(shape.url, addrs[0], opts);
    if (isResult(res)) return res;
    if (res.location) {
      previousSecure = shape.url.protocol === "https:";
      try {
        current = new URL(res.location, shape.url).toString();
      } catch {
        return fail("blokeret", "Kilden henviste til en ugyldig adresse.");
      }
      continue;
    }
    const rawType = String(res.headers["content-type"] ?? "");
    const charset = rawType.match(/charset\s*=\s*"?([\w-]+)"?/i)?.[1]?.toLowerCase() ?? null;
    return { ok: true, url: shape.url.toString(), status: res.status, contentType: rawType.split(";")[0].trim().toLowerCase(), charset, body: res.body ?? Buffer.alloc(0) };
  }
  return fail("omdirigeringer", "Kilden omdirigerer for mange gange.");
}
