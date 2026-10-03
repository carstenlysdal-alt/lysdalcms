/**
 * Modellens svar -> GeneratedArticle. RENT. Tåler små afvigelser (bloktyper under andre navne, kilde som tekst i stedet for liste),
 * men afviser svar uden titel, manchet og mindst to tekstblokke. Alt udefra renses for HTML.
 */
import { z } from "zod";
import { parseSourceRefs } from "./sources";
import type { GenBlock, GeneratedArticle, GenSocial } from "./types";

const clean = (v: unknown, max: number): string =>
  (typeof v === "string" ? v : typeof v === "number" ? String(v) : "")
    .replace(/<[^>]*>/g, " ")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, max);

const list = (v: unknown, max: number, each: number): string[] => {
  const raw = Array.isArray(v) ? v : typeof v === "string" ? v.split(/[,\n]/) : [];
  const out: string[] = [];
  for (const item of raw) {
    const t = clean(item, each);
    if (t && !out.some((o) => o.toLowerCase() === t.toLowerCase())) out.push(t);
    if (out.length >= max) break;
  }
  return out;
};

const TYPE_ALIAS: Record<string, GenBlock["type"]> = {
  afsnit: "afsnit", paragraph: "afsnit", tekst: "afsnit", brodtekst: "afsnit",
  mellemrubrik: "mellemrubrik", underrubrik: "mellemrubrik", heading: "mellemrubrik", subheading: "mellemrubrik", overskrift: "mellemrubrik",
  citat: "citat", quote: "citat",
  faktaboks: "faktaboks", factbox: "faktaboks", infobox: "faktaboks", boks: "faktaboks",
};

const social = (v: unknown): GenSocial | undefined => {
  if (!v || typeof v !== "object") return undefined;
  const o = v as Record<string, unknown>;
  const tekst = clean(o.tekst, 1200);
  if (!tekst) return undefined;
  return { tekst, hashtags: list(o.hashtags, 8, 40).map((h) => h.replace(/^#+/, "").replace(/\s+/g, "")).filter(Boolean) };
};

const rawSchema = z.object({
  titel: z.unknown().optional(),
  manchet: z.unknown().optional(),
  blokke: z.array(z.unknown()).min(1, "Svaret indeholder ingen tekstblokke."),
}).passthrough();

export type ParsedGeneration = { artikel: GeneratedArticle; ukendteBlokke: number };

export function parseGeneration(json: unknown, knownIds: ReadonlySet<string>): ParsedGeneration {
  const parsed = rawSchema.safeParse(json);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Ugyldigt svar.");
  const o = parsed.data as Record<string, unknown>;

  let ukendte = 0;
  const blokke: GenBlock[] = [];
  for (const entry of parsed.data.blokke.slice(0, 80)) {
    if (!entry || typeof entry !== "object") { ukendte++; continue; }
    const b = entry as Record<string, unknown>;
    const type = TYPE_ALIAS[String(b.type ?? "").toLowerCase()];
    const kilder = parseSourceRefs(b.kilde ?? b.kilder, knownIds);
    if (type === "afsnit") {
      const tekst = clean(b.tekst ?? b.content, 4000);
      if (tekst) blokke.push({ type, tekst, kilder });
    } else if (type === "mellemrubrik") {
      const tekst = clean(b.tekst ?? b.text, 160);
      if (tekst) blokke.push({ type, tekst });
    } else if (type === "citat") {
      const tekst = clean(b.tekst ?? b.quote, 1500).replace(/^[»“„"']+|[«”"']+$/g, "").trim();
      if (tekst) blokke.push({ type, tekst, taler: clean(b.taler ?? b.attribution, 200) || null, kilder });
    } else if (type === "faktaboks") {
      const tekst = clean(b.tekst ?? b.content, 2500);
      if (tekst) blokke.push({ type, titel: clean(b.titel ?? b.title, 120) || "Fakta", tekst, kilder });
    } else ukendte++;
  }

  const titel = clean(o.titel, 300);
  const manchet = clean(o.manchet, 600);
  if (!titel) throw new Error("Svaret mangler en overskrift.");
  if (blokke.filter((b) => b.type === "afsnit").length < 2) throw new Error("Svaret er for kort: mindst to afsnit kræves.");

  const opslagRaw = (o.opslag && typeof o.opslag === "object" ? o.opslag : {}) as Record<string, unknown>;
  const billeder = (Array.isArray(o.billeder) ? o.billeder : []).slice(0, 8).flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const b = entry as Record<string, unknown>;
    const [kilde] = parseSourceRefs(b.kilde, knownIds);
    const alt = clean(b.alt, 200);
    return kilde && alt ? [{ kilde, alt, billedtekst: clean(b.billedtekst, 400) }] : [];
  });

  return {
    ukendteBlokke: ukendte,
    artikel: {
      titel,
      manchet,
      blokke,
      seoTitel: clean(o.seoTitel, 200),
      seoBeskrivelse: clean(o.seoBeskrivelse, 400),
      slug: clean(o.slug, 120),
      tldr: clean(o.tldr, 400),
      tags: list(o.tags, 8, 60),
      omraader: list(o.omraader, 4, 80),
      opslag: { facebook: social(opslagRaw.facebook), x: social(opslagRaw.x) },
      billeder,
      brugteKilder: parseSourceRefs(o.brugteKilder, knownIds),
      mangler: list(o.mangler, 8, 240),
    },
  };
}
