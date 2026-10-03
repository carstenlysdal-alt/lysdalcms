/**
 * Kontrol af tal, tidspunkter og citater i en artikel mod UDDRAG fra originalkilderne. KLIENT-SIKKER, ren og deterministisk:
 * ingen AI, ingen netværk. AI-faktatjekket (lib/ai/editorial.ts) lægges ovenpå og er kun et supplement.
 *
 * Status:
 *  - stoettet:      udsagnet findes i et uddrag (angiver hvilken kilde)
 *  - mangler:       der ER uddrag, men udsagnet findes ikke i nogen af dem (kan være rigtigt — men er ikke dokumenteret)
 *  - ukontrolleret: ingen kilde har uddrag, så intet kan kontrolleres
 * "stoettet" betyder KUN, at ordlyden/tallet står i kilden. Det siger ikke, at kilden selv har ret.
 */
export type ClaimKind = "tal" | "tid" | "citat";
export type ClaimStatus = "stoettet" | "mangler" | "ukontrolleret";

export type ClaimSource = { titel: string; uddrag?: string | null };
export type ClaimCheck = { id: string; kind: ClaimKind; tekst: string; status: ClaimStatus; /** 1-baseret kilde-nummer */ kilde: number | null; note: string };

export const MAX_CLAIMS = 40;

const NUMBER_WORDS: Record<string, number> = {
  to: 2, tre: 3, fire: 4, fem: 5, seks: 6, syv: 7, otte: 8, ni: 9, ti: 10, elleve: 11, tolv: 12, tretten: 13, fjorten: 14,
  femten: 15, seksten: 16, sytten: 17, atten: 18, nitten: 19, tyve: 20,
};
const NOT_A_COUNTED_NOUN = new Set(["og", "eller", "af", "i", "på", "til", "der", "som", "er", "har", "at", "en", "et", "den", "det", "de", "for", "med", "om", "fra", "ved", "men", "var", "kan", "vil", "skal", "blev", "ud", "op", "ind", "ned"]);

const wordsOf = (s: string) => s.toLowerCase().normalize("NFC").replace(/[^\p{L}\p{N}]+/gu, " ").trim();

type Span = { start: number; end: number };
const inside = (spans: Span[], i: number) => spans.some((s) => i >= s.start && i < s.end);

function numberKey(raw: string): string | null {
  let t = raw.trim();
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(t)) t = t.replace(/\./g, "").replace(",", ".");
  else t = t.replace(",", ".");
  const n = Number(t);
  return Number.isFinite(n) ? String(n) : null;
}

function timeKey(h: string, m?: string): string | null {
  const hh = Number(h);
  const mm = m === undefined ? 0 : Number(m);
  if (!Number.isInteger(hh) || hh > 23 || mm > 59) return null;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

type Extracted = { kind: ClaimKind; key: string; tekst: string; index: number };

const QUOTE_RE = /»([^«»]{8,500})«|“([^”]{8,500})”|„([^“”]{8,500})[“”]|"([^"]{8,500})"/g;
const TIME_RE = /\bkl\.?\s*(\d{1,2})(?:[:.](\d{2}))?(?!\d)|\b(\d{1,2}):(\d{2})(?!\d)/gi;
const CHAIN_RE = /\d+(?:-\d+){2,}/g;
const NUMBER_RE = /\d+(?:[.,]\d+)*/g;
const NUMBER_WORD_RE = /(?<![\p{L}])(to|tre|fire|fem|seks|syv|otte|ni|ti|elleve|tolv|tretten|fjorten|femten|seksten|sytten|atten|nitten|tyve)\s+([\p{L}][\p{L}-]*)/giu;

/** Udtrækker citater, tidspunkter og tal. Tal inde i citater og i nummerrækker (journalnr., telefon) springes over. */
export function extractClaims(text: string): Extracted[] {
  const out: Extracted[] = [];
  const quoteSpans: Span[] = [];

  for (const m of text.matchAll(QUOTE_RE)) {
    const body = m[1] ?? m[2] ?? m[3] ?? m[4] ?? "";
    if (wordsOf(body).split(" ").filter(Boolean).length < 4) continue;
    quoteSpans.push({ start: m.index!, end: m.index! + m[0].length });
    out.push({ kind: "citat", key: wordsOf(body), tekst: body.trim(), index: m.index! });
  }

  const timeSpans: Span[] = [];
  for (const m of text.matchAll(TIME_RE)) {
    if (inside(quoteSpans, m.index!)) continue;
    const key = m[1] !== undefined ? timeKey(m[1], m[2]) : timeKey(m[3], m[4]);
    if (!key) continue;
    timeSpans.push({ start: m.index!, end: m.index! + m[0].length });
    out.push({ kind: "tid", key, tekst: m[0].trim(), index: m.index! });
  }

  const skip: Span[] = [...quoteSpans, ...timeSpans];
  for (const m of text.matchAll(CHAIN_RE)) skip.push({ start: m.index!, end: m.index! + m[0].length });

  for (const m of text.matchAll(NUMBER_RE)) {
    if (inside(skip, m.index!)) continue;
    const key = numberKey(m[0]);
    if (!key) continue;
    const after = text.slice(m.index! + m[0].length).match(/^\s*([\p{L}%][\p{L}.%-]{0,20})/u);
    out.push({ kind: "tal", key, tekst: `${m[0]}${after ? ` ${after[1]}` : ""}`.trim(), index: m.index! });
  }

  for (const m of text.matchAll(NUMBER_WORD_RE)) {
    if (inside(skip, m.index!)) continue;
    const next = m[2].toLowerCase();
    if (NOT_A_COUNTED_NOUN.has(next)) continue;
    out.push({ kind: "tal", key: String(NUMBER_WORDS[m[1].toLowerCase()]), tekst: `${m[1]} ${m[2]}`, index: m.index! });
  }

  out.sort((a, b) => a.index - b.index);
  const seen = new Set<string>();
  return out.filter((c) => {
    const id = `${c.kind}:${c.key}`;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

type Evidence = { norm: string; words: Set<string>; numbers: Set<string>; times: Set<string> };

function buildEvidence(uddrag: string): Evidence {
  const norm = wordsOf(uddrag);
  const numbers = new Set<string>();
  const times = new Set<string>();
  const timeSpans: Span[] = [];
  for (const m of uddrag.matchAll(TIME_RE)) {
    const key = m[1] !== undefined ? timeKey(m[1], m[2]) : timeKey(m[3], m[4]);
    if (key) { times.add(key); timeSpans.push({ start: m.index!, end: m.index! + m[0].length }); }
  }
  const chains: Span[] = [];
  for (const m of uddrag.matchAll(CHAIN_RE)) chains.push({ start: m.index!, end: m.index! + m[0].length });
  for (const m of uddrag.matchAll(NUMBER_RE)) {
    // Tal inde i et klokkeslæt ("04:00") er ikke selvstændige tal: ellers ville 4 fejlagtigt understøtte "fire".
    if (inside(chains, m.index!) || inside(timeSpans, m.index!)) continue;
    const key = numberKey(m[0]);
    if (key) numbers.add(key);
  }
  for (const word of norm.split(" ")) if (word in NUMBER_WORDS) numbers.add(String(NUMBER_WORDS[word]));
  return { norm, words: new Set(norm.split(" ").filter(Boolean)), numbers, times };
}

export type GroundingOptions = { max?: number };

export function groundClaims(articleText: string, sources: readonly ClaimSource[], opts: GroundingOptions = {}): ClaimCheck[] {
  const claims = extractClaims(articleText).slice(0, opts.max ?? MAX_CLAIMS);
  const evidence = sources.map((s) => (s.uddrag && s.uddrag.trim() ? buildEvidence(s.uddrag) : null));
  const hasEvidence = evidence.some(Boolean);

  return claims.map((c, i) => {
    const id = `c${i + 1}`;
    const base = { id, kind: c.kind, tekst: c.tekst.length > 160 ? `${c.tekst.slice(0, 157)}…` : c.tekst };
    if (!hasEvidence) return { ...base, status: "ukontrolleret" as const, kilde: null, note: "Ingen kilder har uddrag, så udsagnet kan ikke kontrolleres. Indlæg originalen under Kilder." };

    if (c.kind === "citat") {
      const hit = evidence.findIndex((e) => e?.norm.includes(c.key));
      if (hit >= 0) return { ...base, status: "stoettet" as const, kilde: hit + 1, note: `Ordret i kilde ${hit + 1}.` };
      const qWords = c.key.split(" ").filter(Boolean);
      let best = 0;
      let bestSource = -1;
      evidence.forEach((e, idx) => {
        if (!e) return;
        const share = qWords.filter((w) => e.words.has(w)).length / qWords.length;
        if (share > best) { best = share; bestSource = idx; }
      });
      return best >= 0.8
        ? { ...base, status: "mangler" as const, kilde: bestSource + 1, note: `Næsten ordret, men ikke identisk med kilde ${bestSource + 1}. Citater skal gengives ordret.` }
        : { ...base, status: "mangler" as const, kilde: null, note: "Citatet findes ikke i nogen af kildernes uddrag. Dokumentér, hvor det stammer fra." };
    }

    const field = c.kind === "tid" ? "times" : "numbers";
    const hit = evidence.findIndex((e) => e?.[field].has(c.key));
    if (hit >= 0) return { ...base, status: "stoettet" as const, kilde: hit + 1, note: `Findes i kilde ${hit + 1}.` };
    return { ...base, status: "mangler" as const, kilde: null, note: c.kind === "tid" ? "Tidspunktet står ikke i kildernes uddrag." : "Tallet står ikke i kildernes uddrag. Kontrollér det mod originalen." };
  });
}

export function summarizeClaims(checks: readonly ClaimCheck[]): { stoettet: number; mangler: number; ukontrolleret: number; total: number } {
  const count = (s: ClaimStatus) => checks.filter((c) => c.status === s).length;
  return { stoettet: count("stoettet"), mangler: count("mangler"), ukontrolleret: count("ukontrolleret"), total: checks.length };
}
