/**
 * Kildegrundlaget til generatoren: tildeler K-id'er, afviser det, der ikke må bruges, og holder sig inden for loftet. RENT.
 */
import { AI_RESTRICTED_SOURCE_TYPES } from "../ingest/schema";
import { cleanSourceText } from "./extract";
import { LIMITS, PROFILES, type GenSource, type ProfileId, type RawSource } from "./types";

export type PackResult = { ok: true; kilder: GenSource[]; advarsler: string[]; tegn: number } | { ok: false; error: string };

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
const urlKey = (u: string | null) => (u ? u.replace(/^https?:\/\/(www\.)?/i, "").replace(/[#?].*$/, "").replace(/\/+$/, "").toLowerCase() : null);

export function buildSourcePack(raw: readonly RawSource[], profile: ProfileId): PackResult {
  const rules = PROFILES[profile];
  const warnings: string[] = [];
  const kept: RawSource[] = [];

  for (const source of raw) {
    if (source.type && (AI_RESTRICTED_SOURCE_TYPES as readonly string[]).includes(source.type)) {
      return { ok: false, error: `"${source.titel}" er en politi- eller 112-kilde. AI-udkast baseret på dem er spærret; skriv historien selv, og brug kilden som baggrund i Production Engine.` };
    }
    const tekst = cleanSourceText(source.tekst, LIMITS.perSourceChars);
    if (tekst.length < LIMITS.minSourceChars) {
      warnings.push(`"${source.titel}" har ingen brugbar tekst og indgår ikke i grundlaget.`);
      continue;
    }
    const key = urlKey(source.url);
    if (kept.some((k) => (key && urlKey(k.url) === key) || norm(k.tekst).slice(0, 200) === norm(tekst).slice(0, 200))) {
      warnings.push(`"${source.titel}" er en dublet og er sprunget over.`);
      continue;
    }
    kept.push({ ...source, tekst });
  }

  if (kept.length > LIMITS.maxSources) {
    warnings.push(`Højst ${LIMITS.maxSources} kilder pr. artikel: de sidste ${kept.length - LIMITS.maxSources} er sprunget over.`);
    kept.length = LIMITS.maxSources;
  }
  if (kept.length === 0) return { ok: false, error: "Der er ingen kilder med tekst at skrive ud fra. Tilføj en kilde med indhold, eller indsæt teksten." };
  if (kept.length < rules.minKilder) return { ok: false, error: `${rules.titel} kræver mindst ${rules.minKilder} kilder med tekst. Du har ${kept.length}.` };

  // Samlet loft: trim de længste kilder først, så ingen kilde forsvinder helt.
  let total = kept.reduce((n, k) => n + k.tekst.length, 0);
  while (total > LIMITS.totalChars) {
    const longest = kept.reduce((a, b) => (b.tekst.length > a.tekst.length ? b : a));
    const cut = Math.min(longest.tekst.length - LIMITS.minSourceChars, Math.max(500, total - LIMITS.totalChars));
    if (cut <= 0) break;
    longest.tekst = longest.tekst.slice(0, longest.tekst.length - cut);
    total -= cut;
    if (!warnings.some((w) => w.startsWith("Kilderne er afkortet"))) warnings.push("Kilderne er afkortet, så de samlet kan være i grundlaget.");
  }

  const kilder: GenSource[] = kept.map((k, i) => ({
    id: `K${i + 1}`,
    kind: k.kind,
    titel: k.titel.slice(0, 300),
    udgiver: k.udgiver ? k.udgiver.slice(0, 160) : null,
    url: k.url,
    dato: k.dato,
    type: k.type,
    tekst: k.tekst,
    rating: k.rating ?? null,
    billeder: k.billeder.slice(0, 8),
    signalId: k.signalId ?? null,
  }));
  return { ok: true, kilder, advarsler: warnings, tegn: total };
}

/** Henvisninger i kilde-felter ("K1", "k2", "K1, K3", ["K1"]) til en ren liste af kendte id'er. */
export function parseSourceRefs(value: unknown, known: ReadonlySet<string>): string[] {
  const parts = Array.isArray(value) ? value.map(String) : typeof value === "string" ? value.split(/[\s,;]+/) : [];
  const out: string[] = [];
  for (const p of parts) {
    const id = p.trim().toUpperCase().replace(/^\[|\]$/g, "");
    if (/^K\d{1,2}$/.test(id) && known.has(id) && !out.includes(id)) out.push(id);
  }
  return out;
}
