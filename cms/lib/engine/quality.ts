/**
 * Deterministisk tekst- og rubrikkvalitet. KLIENT-SIKKER og ren (ingen AI). Supplerer SEO-scoren (lib/editor/seo-score.ts),
 * som ikke ser på læsbarhed eller rubrikkens form.
 */
export type ReadabilityLabel = "Meget let" | "Let" | "Middel" | "Svær" | "Meget svær";

export type Readability = {
  words: number;
  sentences: number;
  longWords: number;
  /** LIX = ord pr. sætning + procent lange ord (over 6 bogstaver). */
  lix: number;
  label: ReadabilityLabel;
  /** Passer niveauet til en lokalnyhed? (LIX højst 45) */
  fitForNews: boolean;
  avgSentenceWords: number;
  /** De længste sætninger over 30 ord (højst 3), forkortet. */
  longSentences: string[];
};

const ABBREVIATIONS = /\b(kl|ca|mio|mia|bl\.a|f\.eks|fx|osv|m\.fl|nr|st|jf|dvs|inkl|ekskl|evt|pga|vha|mv|kr|tlf|dr|hr|fru|pct)\./gi;
// Tal med skilletegn ("14.45", "400.000", "01:30") er ét ord.
const WORD_RE = /\p{N}+(?:[.,:]\p{N}+)*|\p{L}[\p{L}\p{N}'’-]*/gu;

export function labelForLix(lix: number): ReadabilityLabel {
  if (lix <= 25) return "Meget let";
  if (lix <= 35) return "Let";
  if (lix <= 45) return "Middel";
  if (lix <= 55) return "Svær";
  return "Meget svær";
}

function splitSentences(text: string): string[] {
  const protectedText = text
    .replace(ABBREVIATIONS, (m) => m.slice(0, -1))
    .replace(/(\d)\.(?=\d)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
  return protectedText.split(/(?<=[.!?…])["»«”)]*\s+(?=[\p{Lu}\p{N}»"„])/u).map((s) => s.trim()).filter(Boolean);
}

export function readability(text: string): Readability {
  const sentences = splitSentences(text);
  const words = text.match(WORD_RE) ?? [];
  const letters = (w: string) => w.replace(/[^\p{L}\p{N}]/gu, "");
  const longWords = words.filter((w) => letters(w).length > 6).length;
  const sentenceCount = Math.max(1, sentences.length);
  const lix = words.length === 0 ? 0 : Math.round(words.length / sentenceCount + (longWords * 100) / words.length);
  const long = sentences
    .map((s) => ({ s, n: (s.match(WORD_RE) ?? []).length }))
    .filter((x) => x.n > 30)
    .sort((a, b) => b.n - a.n)
    .slice(0, 3)
    .map((x) => (x.s.length > 140 ? `${x.s.slice(0, 137)}…` : x.s));
  return {
    words: words.length,
    sentences: sentences.length,
    longWords,
    lix,
    label: labelForLix(lix),
    fitForNews: lix <= 45,
    avgSentenceWords: Math.round((words.length / sentenceCount) * 10) / 10,
    longSentences: long,
  };
}

export type HeadlineCheck = { id: string; label: string; status: "ok" | "warn" | "fail"; hint: string };

const CLICKBAIT = /\b(chok|chokerende|sandheden om|du vil ikke tro|ikke til at tro|vildt|vanvittig|det her skal du se)\b/i;

/** Rubrikkens form: længde, versaler, udråbstegn, kliché-ord. Siger intet om, om rubrikken er SAND over for teksten. */
export function headlineChecks(titel: string): HeadlineCheck[] {
  const t = titel.trim();
  const len = Array.from(t).length;
  const letters = t.replace(/[^\p{L}]/gu, "");
  const upperWords = (t.match(/\b\p{Lu}{4,}\b/gu) ?? []).length;
  return [
    {
      id: "laengde",
      label: "Længde",
      status: len === 0 ? "fail" : len >= 40 && len <= 70 ? "ok" : (len >= 25 && len < 40) || (len > 70 && len <= 110) ? "warn" : "fail",
      hint: len === 0 ? "Mangler rubrik." : `${len} tegn. Ideelt 40-70; højst 110.`,
    },
    {
      id: "versaler",
      label: "Versaler",
      status: upperWords === 0 && !(letters.length > 8 && letters === letters.toUpperCase()) ? "ok" : "warn",
      hint: upperWords === 0 ? "Ingen ord med store bogstaver." : "Undgå ord med kun store bogstaver.",
    },
    { id: "udraab", label: "Udråbstegn", status: t.includes("!") ? "warn" : "ok", hint: t.includes("!") ? "Udråbstegn virker useriøst i nyhedsrubrikker." : "Ingen udråbstegn." },
    { id: "clickbait", label: "Lokke-ord", status: CLICKBAIT.test(t) ? "warn" : "ok", hint: CLICKBAIT.test(t) ? "Indeholder et lokke-ord. Rubrikken må ikke love mere, end artiklen holder." : "Ingen lokke-ord." },
    { id: "kolon", label: "Opbygning", status: (t.match(/:/g) ?? []).length > 1 ? "warn" : "ok", hint: (t.match(/:/g) ?? []).length > 1 ? "Flere kolon gør rubrikken tung at læse." : "Enkel opbygning." },
  ];
}
