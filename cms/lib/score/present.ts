/** Local Score til visning: serialiserbar og uden afhængigheder. RENT. */
import type { ScoreAnalysis } from "../ai/score";
import { BAND_LABEL, DIMENSION_IDS, DIMENSION_LABEL, FUNCTION_LABEL, PILLAR_LABEL, type Band } from "./config";
import type { ScoreResult } from "./model";

export type CardScore = {
  total: number;
  band: Band;
  bandLabel: string;
  funktion: string;
  sekundaere: string[];
  soejle: string;
  format: string;
  prioritet: "A" | "B" | "C" | null;
  dimensioner: Array<{ navn: string; score: number; begrundelse: string | null }>;
  soejler: Array<{ navn: string; score: number }>;
  resume: string;
  hvorViktigt: string;
  vinkler: string[];
  loeft: string;
  mangler: string[];
  advarsel: string;
  tidIso: string;
};

export function toCardScore(view: { result: ScoreResult; analyse: ScoreAnalysis; createdAt: string }): CardScore {
  const r = view.result;
  const a = view.analyse;
  return {
    total: r.total,
    band: r.band,
    bandLabel: BAND_LABEL[r.band],
    funktion: FUNCTION_LABEL[r.primaryFunction],
    sekundaere: r.secondaryFunctions.map((f) => FUNCTION_LABEL[f]),
    soejle: PILLAR_LABEL[r.pillar],
    format: r.recommendedFormat,
    prioritet: r.suggestedPriority,
    dimensioner: DIMENSION_IDS.map((d) => ({ navn: DIMENSION_LABEL[d].navn, score: r.dimensions[d], begrundelse: a.begrundelser[d] ?? null })),
    soejler: (Object.keys(r.pillarScores) as Array<keyof typeof r.pillarScores>).map((p) => ({ navn: PILLAR_LABEL[p], score: r.pillarScores[p] })),
    resume: a.resume, hvorViktigt: a.hvorViktigt, vinkler: a.vinkler, loeft: a.loeft, mangler: a.mangler, advarsel: a.advarsel,
    tidIso: view.createdAt,
  };
}
