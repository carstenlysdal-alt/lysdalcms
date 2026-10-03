import "server-only";
import type { AuthorizedUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { checkRobots } from "@/lib/net/robots";
import { PAGE_CONTENT_TYPES, PDF_CONTENT_TYPES, safeFetch, type SafeFetchDeps } from "@/lib/net/safe-fetch";
import { can, PERMISSIONS } from "@/lib/permissions";
import { rateLimit } from "@/lib/ratelimit";
import { cleanText, isHttpUrl } from "@/lib/validation/text";
import { cleanSourceText, decodeBody, extractArticleFromHtml, extractPdfText } from "./extract";
import { LIMITS, type ImageRef } from "./types";

/**
 * Hent materiale til generatoren: en webadresse (side eller PDF), en uploadet PDF eller indsat tekst. Alt er redaktørens eget valg
 * (S16: adresser i feeds hentes aldrig), og al hentning går gennem safeFetch. Billeder gemmes kun som reference, aldrig som filer.
 */
export type SourceDraftResult =
  | { ok: true; kilde: { kind: "url" | "pdf" | "tekst"; titel: string; udgiver: string | null; url: string | null; dato: string | null; type: string | null; tekst: string; billeder: ImageRef[] }; advarsler: string[] }
  | { ok: false; error: string };

async function guard(user: AuthorizedUser, bucket: string, limit: number): Promise<string | null> {
  if (!can(user, PERMISSIONS.ARTICLE_CREATE) || !can(user, PERMISSIONS.ARTICLE_AI_USE)) return "Du har ikke adgang til at hente kilder til artikelgeneratoren.";
  const limited = await rateLimit({ bucket, key: user.id, limit, windowMs: 10 * 60_000 });
  return limited.ok ? null : `For mange forsøg. Vent ${limited.retryAfterSec} sekunder, og prøv igen.`;
}

const titleFromUrl = (url: string) => {
  try {
    const name = decodeURIComponent(new URL(url).pathname.split("/").filter(Boolean).pop() ?? "").replace(/\.[a-z0-9]{2,4}$/i, "").replace(/[-_]+/g, " ").trim();
    return name || new URL(url).hostname;
  } catch {
    return url;
  }
};

export async function fetchUrlSource(user: AuthorizedUser, rawUrl: string, deps: SafeFetchDeps = {}): Promise<SourceDraftResult> {
  const denied = await guard(user, "generate-fetch", 30);
  if (denied) return { ok: false, error: denied };
  const url = rawUrl.trim();
  if (!isHttpUrl(url)) return { ok: false, error: "Skriv en gyldig adresse, der starter med http:// eller https://." };

  const robots = await checkRobots(url, deps);
  if (!robots.allowed) return { ok: false, error: "Siden forbyder automatisk hentning (robots.txt). Åbn den selv, og indsæt teksten som tekstkilde i stedet." };
  const res = await safeFetch(url, { contentTypes: [...PAGE_CONTENT_TYPES, ...PDF_CONTENT_TYPES], maxBytes: LIMITS.pdfBytes, timeoutMs: 20_000, accept: "text/html,application/xhtml+xml,application/pdf;q=0.9,*/*;q=0.1" }, deps);
  if (!res.ok) return { ok: false, error: res.message };

  if (res.contentType === "application/pdf") {
    const pdf = await extractPdfText(res.body);
    if (!pdf.ok) return { ok: false, error: pdf.error };
    return { ok: true, kilde: { kind: "pdf", titel: pdf.titel && pdf.titel.length > 8 ? pdf.titel : titleFromUrl(res.url), udgiver: new URL(res.url).hostname.replace(/^www\./, ""), url: res.url, dato: null, type: null, tekst: pdf.tekst.slice(0, LIMITS.perSourceChars), billeder: [] }, advarsler: pdf.afkortet ? [`PDF'en har mange sider; kun de første ${LIMITS.maxPdfPages} er læst.`] : [] };
  }
  if (res.body.length > 1024 * 1024) return { ok: false, error: "Siden er for stor til at læse. Indsæt den relevante tekst som tekstkilde." };
  const page = extractArticleFromHtml(decodeBody(res.body, res.charset), res.url);
  if (page.tekst.length < LIMITS.minSourceChars) return { ok: false, error: "Der kunne ikke læses en artikeltekst på siden (den kan kræve login eller JavaScript). Indsæt teksten som tekstkilde i stedet." };
  const advarsler: string[] = [];
  if (!page.dato) advarsler.push("Udgivelsesdatoen kunne ikke aflæses. Udfyld den, hvis du kender den.");
  return {
    ok: true,
    kilde: { kind: "url", titel: page.titel || titleFromUrl(res.url), udgiver: page.udgiver, url: page.canonical ?? res.url, dato: page.dato, type: null, tekst: page.tekst.slice(0, LIMITS.perSourceChars), billeder: page.billeder },
    advarsler,
  };
}

export async function readPdfSource(user: AuthorizedUser, file: { name: string; bytes: Uint8Array }): Promise<SourceDraftResult> {
  const denied = await guard(user, "generate-pdf", 20);
  if (denied) return { ok: false, error: denied };
  const pdf = await extractPdfText(file.bytes);
  if (!pdf.ok) return { ok: false, error: pdf.error };
  const name = cleanText(file.name.replace(/\.pdf$/i, "").replace(/[-_]+/g, " "), 200);
  return { ok: true, kilde: { kind: "pdf", titel: name || pdf.titel || "Uploadet PDF", udgiver: null, url: null, dato: null, type: null, tekst: pdf.tekst.slice(0, LIMITS.perSourceChars), billeder: [] }, advarsler: pdf.afkortet ? [`PDF'en har mange sider; kun de første ${LIMITS.maxPdfPages} er læst.`] : [] };
}

/** Indsat tekst renses på serveren og tæller som kilde på lige fod med de øvrige. */
export function textSource(input: { titel: string; udgiver?: string | null; dato?: string | null; tekst: string }): SourceDraftResult {
  const tekst = cleanSourceText(input.tekst, LIMITS.perSourceChars);
  if (tekst.length < LIMITS.minSourceChars) return { ok: false, error: `Teksten er for kort. Der skal mindst være ${LIMITS.minSourceChars} tegn.` };
  return { ok: true, kilde: { kind: "tekst", titel: cleanText(input.titel, 300) || "Indsat tekst", udgiver: input.udgiver ? cleanText(input.udgiver, 160) || null : null, url: null, dato: input.dato && /^\d{4}-\d{2}-\d{2}$/.test(input.dato) ? input.dato : null, type: null, tekst, billeder: [] }, advarsler: [] };
}

/** Seneste signaler som valgbare kilder (kun den aktive by). */
export async function listSignalOptions(user: AuthorizedUser, take = 40) {
  const rows = await db.signal.findMany({ where: { instansId: user.instansId }, orderBy: { createdAt: "desc" }, take, select: { id: true, overskrift: true, kilde: true, sourceType: true, createdAt: true, brødtekst: true } });
  return rows.map((r) => ({ id: r.id, titel: r.overskrift, kilde: r.kilde, type: r.sourceType, tidIso: r.createdAt.toISOString(), harTekst: (r.brødtekst ?? "").length >= 50 }));
}
