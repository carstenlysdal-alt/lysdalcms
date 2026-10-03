/**
 * Local Score: beregningen. RENT og deterministisk: samme estimater og konfiguration giver altid samme resultat.
 * AI leverer KUN delscorer (7 dimensioner og 11 funktioner, 0-100). Total, bånd, primær og sekundære funktioner, søjler,
 * anbefalet format og foreslået prioritet beregnes her. AI's egne totaler eller bånd bruges aldrig.
 */
import { DIMENSION_IDS, FUNCTION_IDS, PILLAR_IDS, type Band, type DimensionId, type FunctionId, type PillarId, type ScoreConfig } from "./config";

export type ScoreEstimates = {
  dimensions: Record<DimensionId, number>;
  functions: Record<FunctionId, number>;
};

export type ScoreResult = {
  dimensions: Record<DimensionId, number>;
  functions: Record<FunctionId, number>;
  total: number;
  band: Band;
  primaryFunction: FunctionId;
  secondaryFunctions: FunctionId[];
  pillar: PillarId;
  pillarScores: Record<PillarId, number>;
  recommendedFormat: string;
  suggestedPriority: "A" | "B" | "C" | null;
  /** Bidrag til totalen pr. dimension (vægt × score), største først. Til forklaringen i UI. */
  bidrag: Array<{ dimension: DimensionId; bidrag: number }>;
};

export function clampScore(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function bandFor(total: number, thresholds: ScoreConfig["thresholds"]): Band {
  for (const t of thresholds) if (total >= t.min) return t.band;
  return thresholds[thresholds.length - 1].band;
}

export function computeScore(estimates: ScoreEstimates, config: ScoreConfig): ScoreResult {
  const dimensions = {} as Record<DimensionId, number>;
  const functions = {} as Record<FunctionId, number>;
  for (const d of DIMENSION_IDS) dimensions[d] = clampScore(estimates.dimensions[d]);
  for (const f of FUNCTION_IDS) functions[f] = clampScore(estimates.functions[f]);

  const raw = DIMENSION_IDS.reduce((sum, d) => sum + dimensions[d] * config.weights[d], 0);
  const total = clampScore(raw);
  const band = bandFor(total, config.thresholds);

  // Primær funktion: højeste score; ved lighed den, der står først i rækkefølgen.
  const order = new Map(config.tiebreak.map((f, i) => [f, i]));
  const ranked = [...FUNCTION_IDS].sort((a, b) => functions[b] - functions[a] || (order.get(a) ?? 99) - (order.get(b) ?? 99));
  const primaryFunction = ranked[0];
  const secondaryFunctions = ranked.slice(1).filter((f) => functions[f] > config.secondaryMin).slice(0, config.secondaryMax);

  const pillarScores = {} as Record<PillarId, number>;
  for (const p of PILLAR_IDS) {
    let sum = 0;
    for (const [key, w] of Object.entries(config.pillarWeights[p])) sum += (key === "trust" ? dimensions.trust : functions[key as FunctionId]) * (w ?? 0);
    pillarScores[p] = clampScore(sum);
  }

  const bidrag = DIMENSION_IDS.map((dimension) => ({ dimension, bidrag: Math.round(dimensions[dimension] * config.weights[dimension] * 10) / 10 })).sort((a, b) => b.bidrag - a.bidrag);
  return {
    dimensions, functions, total, band, primaryFunction, secondaryFunctions,
    pillar: config.pillarByFunction[primaryFunction],
    pillarScores,
    recommendedFormat: config.formatByFunction[primaryFunction],
    suggestedPriority: config.priorityByBand[band] ?? null,
    bidrag,
  };
}
