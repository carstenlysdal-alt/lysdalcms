/** Validering af feed-definitioner. RENT (ingen database). */
import { SOURCE_TYPES } from "@/lib/ingest/schema";
import { cleanText, isHttpUrl } from "@/lib/validation/text";

export const FEED_TYPES = ["rss", "api", "web", "mail"] as const;
export type FeedType = (typeof FEED_TYPES)[number];
export const FEED_TYPE_LABEL: Record<FeedType, string> = { rss: "RSS/Atom", api: "API", web: "Webside", mail: "Mail/nyhedsbrev" };

export type FeedInput = {
  navn: string;
  type: FeedType;
  url: string | null;
  sourceType: string | null;
  omraadeTekst: string | null;
  inkluder: string[];
  ekskluder: string[];
  intervalMin: number;
  aktiv: boolean;
  noter: string | null;
};
export type ParsedFeed = { ok: true; value: FeedInput } | { ok: false; error: string };

export const MAX_KEYWORDS = 20;

/** "a, b\nc" -> ["a","b","c"]: trimmet, 2-40 tegn, uden dubletter (uden hensyn til store/små bogstaver). */
export function parseKeywords(raw: unknown): { ok: true; value: string[] } | { ok: false; error: string } {
  const text = typeof raw === "string" ? raw : Array.isArray(raw) ? raw.join("\n") : "";
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of text.split(/[,\n]/)) {
    const word = cleanText(part, 40);
    if (!word) continue;
    if (word.length < 2) return { ok: false, error: `Nøgleordet "${word}" er for kort.` };
    const key = word.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(word);
  }
  if (out.length > MAX_KEYWORDS) return { ok: false, error: `Højst ${MAX_KEYWORDS} nøgleord.` };
  return { ok: true, value: out };
}

export function parseFeedInput(raw: Record<string, unknown>): ParsedFeed {
  const navn = cleanText(raw.navn, 80);
  if (navn.length < 2) return { ok: false, error: "Angiv et navn på mindst 2 tegn." };
  const type = (FEED_TYPES as readonly string[]).includes(String(raw.type)) ? (raw.type as FeedType) : null;
  if (!type) return { ok: false, error: "Ukendt feed-type." };

  const urlRaw = typeof raw.url === "string" ? raw.url.trim() : "";
  if (type !== "mail" && !urlRaw) return { ok: false, error: "Angiv feedets adresse (URL)." };
  if (urlRaw && !isHttpUrl(urlRaw)) return { ok: false, error: "Adressen skal være en gyldig http(s)-URL." };

  const sourceTypeRaw = typeof raw.sourceType === "string" ? raw.sourceType : "";
  if (sourceTypeRaw && !(SOURCE_TYPES as readonly string[]).includes(sourceTypeRaw)) return { ok: false, error: "Ukendt kildetype." };

  const inkluder = parseKeywords(raw.inkluder);
  if (!inkluder.ok) return inkluder;
  const ekskluder = parseKeywords(raw.ekskluder);
  if (!ekskluder.ok) return ekskluder;

  const interval = Number(typeof raw.intervalMin === "string" ? raw.intervalMin.trim() : raw.intervalMin ?? 30);
  if (!Number.isInteger(interval) || interval < 5 || interval > 1440) return { ok: false, error: "Intervallet skal være mellem 5 og 1440 minutter." };

  return {
    ok: true,
    value: {
      navn,
      type,
      url: urlRaw || null,
      sourceType: sourceTypeRaw || null,
      omraadeTekst: cleanText(raw.omraadeTekst, 120) || null,
      inkluder: inkluder.value,
      ekskluder: ekskluder.value,
      intervalMin: interval,
      aktiv: raw.aktiv === undefined ? true : raw.aktiv === true || raw.aktiv === "on" || raw.aktiv === "true",
      noter: cleanText(raw.noter, 300, { multiline: true }) || null,
    },
  };
}
