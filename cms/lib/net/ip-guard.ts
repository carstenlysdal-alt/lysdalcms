/**
 * Adressekontrol mod SSRF. RENT (ingen netværk): afgør, om en IP-adresse eller et værtsnavn må forbindes til fra serveren.
 * Følger reglerne S1-S6 i docs/localrating/10-feeds-rettigheder-og-ssrf.md.
 */
import { isIP } from "node:net";

type Cidr4 = readonly [string, number];

const BLOCKED_V4: readonly Cidr4[] = [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16], ["172.16.0.0", 12],
  ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.88.99.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15], ["198.51.100.0", 24],
  ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4], ["255.255.255.255", 32],
];

const ipv4ToInt = (ip: string): number | null => {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) return null;
    const v = Number(p);
    if (v > 255) return null;
    n = n * 256 + v;
  }
  return n;
};

const inCidr4 = (n: number, [base, bits]: Cidr4) => {
  const b = ipv4ToInt(base);
  if (b === null) return false;
  const size = 2 ** (32 - bits);
  return Math.floor(n / size) === Math.floor(b / size);
};

export function isBlockedIpv4(ip: string): boolean {
  const n = ipv4ToInt(ip);
  if (n === null) return true; // uforståelig adresse = lukket
  return BLOCKED_V4.some((c) => inCidr4(n, c));
}

/** "::ffff:1.2.3.4", "2001:db8::1" -> otte 16-bit-grupper, eller null hvis ugyldig. */
export function parseIpv6(ip: string): number[] | null {
  let text = ip.toLowerCase();
  const zone = text.indexOf("%");
  if (zone >= 0) text = text.slice(0, zone);
  const tail = text.match(/^(.*:)(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (tail) {
    const v4 = ipv4ToInt(tail[2]);
    if (v4 === null) return null;
    text = `${tail[1]}${((v4 >>> 16) & 0xffff).toString(16)}:${(v4 & 0xffff).toString(16)}`;
  }
  const halves = text.split("::");
  if (halves.length > 2) return null;
  const toGroups = (s: string) => (s === "" ? [] : s.split(":"));
  const head = toGroups(halves[0]);
  const rest = halves.length === 2 ? toGroups(halves[1]) : [];
  if (halves.length === 1 && head.length !== 8) return null;
  if (halves.length === 2 && head.length + rest.length > 7) return null;
  const groups = halves.length === 2 ? [...head, ...Array(8 - head.length - rest.length).fill("0"), ...rest] : head;
  const out: number[] = [];
  for (const g of groups) {
    if (!/^[0-9a-f]{1,4}$/.test(g)) return null;
    out.push(parseInt(g, 16));
  }
  return out.length === 8 ? out : null;
}

const embedded4 = (hi: number, lo: number) => `${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`;

export function isBlockedIpv6(ip: string): boolean {
  const g = parseIpv6(ip);
  if (!g) return true;
  const [a, b, c, d, e, f, h, i] = g;
  const allZeroTo = (n: number) => g.slice(0, n).every((x) => x === 0);
  if (allZeroTo(7) && (i === 0 || i === 1)) return true; // ::  og ::1
  if (allZeroTo(5) && f === 0xffff) return isBlockedIpv4(embedded4(h, i)); // ::ffff:0:0/96 (IPv4-mapped)
  if (allZeroTo(6)) return isBlockedIpv4(embedded4(h, i)); // ::a.b.c.d (forældet IPv4-kompatibel)
  if (a === 0x64 && b === 0xff9b && c === 0 && d === 0 && e === 0 && f === 0) return isBlockedIpv4(embedded4(h, i)); // NAT64
  if (a === 0x100 && b === 0 && c === 0 && d === 0) return true; // 100::/64
  if (a === 0x2001 && b === 0) return true; // Teredo
  if (a === 0x2001 && b === 0xdb8) return true; // dokumentation
  if (a === 0x2002) return true; // 6to4: indlejrer en IPv4-adresse, så hele området lukkes
  if ((a & 0xfe00) === 0xfc00) return true; // fc00::/7
  if ((a & 0xffc0) === 0xfe80) return true; // fe80::/10
  if ((a & 0xffc0) === 0xfec0) return true; // fec0::/10
  if ((a & 0xff00) === 0xff00) return true; // ff00::/8
  return false;
}

export function isBlockedIp(ip: string): boolean {
  const kind = isIP(ip);
  if (kind === 4) return isBlockedIpv4(ip);
  if (kind === 6) return isBlockedIpv6(ip);
  return true;
}

const BLOCKED_SUFFIXES = [".localhost", ".local", ".internal", ".lan", ".home.arpa", ".railway.internal"];
const BLOCKED_NAMES = new Set(["localhost", "metadata", "metadata.google.internal", "instance-data"]);

export type UrlCheck = { ok: true; url: URL; hostname: string; literalIp: string | null } | { ok: false; message: string };

/**
 * S1-S5: kun http(s), ingen brugeroplysninger, kun port 80/443, værtsnavn normaliseret, ingen interne navne.
 * WHATWG-URL normaliserer allerede decimale, oktale og hex-adresser ("2130706433", "0x7f.1") til punktum-form.
 */
export function checkUrlShape(raw: string, opts: { extraPorts?: readonly number[] } = {}): UrlCheck {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return { ok: false, message: "Adressen er ikke en gyldig URL." };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return { ok: false, message: "Kun http- og https-adresser er tilladt." };
  if (url.username || url.password) return { ok: false, message: "Adressen må ikke indeholde brugernavn eller adgangskode." };
  const port = url.port ? Number(url.port) : url.protocol === "https:" ? 443 : 80;
  const allowed = [80, 443, ...(opts.extraPorts ?? [])];
  if (!allowed.includes(port)) return { ok: false, message: "Adressen bruger en port, der ikke er tilladt." };
  let hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  const literal = hostname.startsWith("[") ? hostname.slice(1, -1) : hostname;
  const kind = isIP(literal);
  if (kind) return { ok: true, url, hostname: literal, literalIp: literal };
  if (!hostname || hostname.length > 253 || BLOCKED_NAMES.has(hostname) || BLOCKED_SUFFIXES.some((s) => hostname.endsWith(s))) {
    return { ok: false, message: "Værtsnavnet er ikke tilladt." };
  }
  if (!hostname.includes(".")) return { ok: false, message: "Værtsnavnet er ikke tilladt." };
  hostname = hostname.normalize("NFC");
  return { ok: true, url, hostname, literalIp: null };
}

/** S17: valgfri streng tilstand. Tom liste = alle offentlige værter. */
export function hostAllowed(hostname: string, suffixes: readonly string[]): boolean {
  if (suffixes.length === 0) return true;
  return suffixes.some((s) => {
    const suf = s.trim().toLowerCase().replace(/^\./, "");
    return suf && (hostname === suf || hostname.endsWith(`.${suf}`));
  });
}
