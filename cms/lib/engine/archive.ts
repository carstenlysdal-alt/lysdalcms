/**
 * Emneoverlap mellem et signal/en historie og tidligere artikler. KLIENT-SIKKER og ren. Det er et enkelt nøgleordsoverlap
 * (ikke AI og ikke semantisk søgning), og det kaldes derfor "emneoverlap" i UI'et — aldrig "AI-match".
 */
const STOP = new Set(
  ("og i på til af at en et er der som med for de den det om fra har var ikke har kan vil skal blev ved men også så over under efter før mellem " +
    "ud op ind ned hos mod hvor hvad hvem hvis fordi flere mindst natten tirsdag mandag onsdag torsdag fredag lørdag søndag nu nyt nye ny " +
    "politi politiet kommune kommunen").split(" "),
);

/** Grov stamme til dansk bøjning: de første 6 bogstaver ("indbrudsbølge" og "indbrud" mødes). */
export function stem(word: string): string {
  return word.slice(0, 6);
}

function tokens(text: string): string[] {
  return text.toLowerCase().normalize("NFC").split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 4 && !STOP.has(w) && !/^\d+$/.test(w));
}

/** De mest brugte nøgleord (stammer), titlen vejer dobbelt. */
export function keywords(text: string, title = "", max = 12): string[] {
  const freq = new Map<string, number>();
  for (const w of tokens(text)) freq.set(stem(w), (freq.get(stem(w)) ?? 0) + 1);
  for (const w of tokens(title)) freq.set(stem(w), (freq.get(stem(w)) ?? 0) + 2);
  return [...freq.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "da")).slice(0, max).map(([k]) => k);
}

export type ArchiveCandidate = { titel: string; manchet?: string | null; tags?: readonly string[] };

/** 0-100: andelen af forespørgslens nøgleord, der også findes i kandidaten (mindst 3 nævnere, så ét tilfældigt ord ikke giver 100). */
export function overlapScore(queryKeywords: readonly string[], candidate: ArchiveCandidate): number {
  if (queryKeywords.length === 0) return 0;
  const cand = new Set(keywords(`${candidate.manchet ?? ""} ${(candidate.tags ?? []).join(" ")}`, candidate.titel, 30));
  const hits = queryKeywords.filter((k) => cand.has(k)).length;
  return Math.min(100, Math.round((hits / Math.max(3, Math.min(queryKeywords.length, 8))) * 100));
}

export const MIN_ARCHIVE_SCORE = 25;
