/** Validering af kilderegister-input. RENT (ingen database) og delt mellem server action, tests og UI. */
import { cleanText } from "@/lib/validation/text";
import { normalizeHost, TYPE_DEFAULTS } from "@/lib/engine/source-rating";

export type SourceProfileInput = { navn: string; type: string; domaene: string | null; score: number; note: string | null; aktiv: boolean };
export type ParsedSourceProfile = { ok: true; value: SourceProfileInput } | { ok: false; error: string };

export const SOURCE_TYPE_OPTIONS = Object.entries(TYPE_DEFAULTS).map(([value, v]) => ({ value, label: v.label, score: v.score }));

export function parseSourceProfileInput(raw: { navn?: unknown; type?: unknown; domaene?: unknown; score?: unknown; note?: unknown; aktiv?: unknown }): ParsedSourceProfile {
  const navn = cleanText(raw.navn, 80);
  if (navn.length < 2) return { ok: false, error: "Angiv et navn på mindst 2 tegn." };
  const type = typeof raw.type === "string" ? raw.type : "andet";
  if (!(type in TYPE_DEFAULTS)) return { ok: false, error: "Ukendt kildetype." };

  const domainRaw = typeof raw.domaene === "string" ? raw.domaene.trim() : "";
  let domaene: string | null = null;
  if (domainRaw) {
    domaene = normalizeHost(domainRaw);
    if (!domaene) return { ok: false, error: "Ugyldigt domæne. Skriv fx politi.dk." };
  }

  const scoreText = typeof raw.score === "number" ? String(raw.score) : typeof raw.score === "string" ? raw.score.trim() : "";
  const score = Number(scoreText);
  if (scoreText === "" || !Number.isInteger(score) || score < 0 || score > 100) return { ok: false, error: "Scoren skal være et helt tal mellem 0 og 100." };

  const note = cleanText(raw.note, 240) || null;
  return { ok: true, value: { navn, type, domaene, score, note, aktiv: raw.aktiv === undefined ? true : raw.aktiv === true || raw.aktiv === "on" || raw.aktiv === "true" } };
}
