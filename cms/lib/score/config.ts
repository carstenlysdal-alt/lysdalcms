/**
 * Local Score (porteret Y Rating): konfigurationen som DATA. RENT og klient-sikkert.
 * AI estimerer delscorer; total, bånd, primær funktion og søjler beregnes af koden ud fra denne konfiguration (model.ts).
 * Redaktionen redigerer konfigurationen i Kontrolrummet (gemt som prompt "rating.scoreConfig", så den er versioneret).
 */
export const DIMENSION_IDS = ["audience_relevance", "impact", "counter_narrative_value", "perspective_value", "decision_value", "trust", "production_potential"] as const;
export type DimensionId = (typeof DIMENSION_IDS)[number];

export const FUNCTION_IDS = ["challenge", "blind_spot", "perspective", "mythbuster", "signal", "threat", "opportunity", "inspiration", "guide", "curiosity", "solution"] as const;
export type FunctionId = (typeof FUNCTION_IDS)[number];

export const PILLAR_IDS = ["challenge", "inspire", "understand"] as const;
export type PillarId = (typeof PILLAR_IDS)[number];

export const BANDS = ["URGENT", "HIGH", "POTENTIAL", "REVIEW", "IGNORE"] as const;
export type Band = (typeof BANDS)[number];

export const DIMENSION_LABEL: Record<DimensionId, { navn: string; hjaelp: string }> = {
  audience_relevance: { navn: "Målgruppens relevans", hjaelp: "Hvor meget betyder det for mediets læsere og deres hverdag?" },
  impact: { navn: "Gennemslagskraft", hjaelp: "Hvor mange og hvor meget berøres, og hvor stor er konsekvensen?" },
  counter_narrative_value: { navn: "Modvægt", hjaelp: "Udfordrer det et indforstået eller ensidigt narrativ?" },
  perspective_value: { navn: "Perspektiv", hjaelp: "Sætter det tingene ind i en større sammenhæng?" },
  decision_value: { navn: "Beslutningsværdi", hjaelp: "Hjælper det læseren med at træffe en konkret beslutning?" },
  trust: { navn: "Troværdighed", hjaelp: "Kan det dokumenteres, og er kilden til at stole på?" },
  production_potential: { navn: "Produktionspotentiale", hjaelp: "Er der adgang til kilder, personer og materiale til en stærk historie?" },
};

export const FUNCTION_LABEL: Record<FunctionId, string> = {
  challenge: "Udfordrer", blind_spot: "Blind vinkel", perspective: "Perspektiverer", mythbuster: "Aflive myter", signal: "Tidligt signal", threat: "Trussel",
  opportunity: "Mulighed", inspiration: "Inspirerer", guide: "Vejleder", curiosity: "Vækker nysgerrighed", solution: "Løsning",
};
export const PILLAR_LABEL: Record<PillarId, string> = { challenge: "Udfordr", inspire: "Inspirer", understand: "Forstå" };
export const BAND_LABEL: Record<Band, string> = { URGENT: "Kritisk", HIGH: "Høj", POTENTIAL: "Værd at følge", REVIEW: "Lav", IGNORE: "Ignorér" };

export type ScoreConfig = {
  weights: Record<DimensionId, number>;
  thresholds: Array<{ min: number; band: Band }>;
  /** Rækkefølge ved lighed mellem funktioner: den første vinder. */
  tiebreak: FunctionId[];
  secondaryMin: number;
  secondaryMax: number;
  pillarWeights: Record<PillarId, Partial<Record<FunctionId | "trust", number>>>;
  pillarByFunction: Record<FunctionId, PillarId>;
  formatByFunction: Record<FunctionId, string>;
  /** Foreslået prioritet pr. bånd (A/B/C). Redaktøren vælger altid selv den endelige. */
  priorityByBand: Partial<Record<Band, "A" | "B" | "C">>;
};

export const DEFAULT_SCORE_CONFIG: ScoreConfig = {
  weights: { audience_relevance: 0.2, impact: 0.15, counter_narrative_value: 0.15, perspective_value: 0.15, decision_value: 0.15, trust: 0.15, production_potential: 0.05 },
  thresholds: [{ min: 85, band: "URGENT" }, { min: 70, band: "HIGH" }, { min: 55, band: "POTENTIAL" }, { min: 40, band: "REVIEW" }, { min: 0, band: "IGNORE" }],
  tiebreak: ["challenge", "blind_spot", "solution", "threat", "signal", "perspective", "mythbuster", "opportunity", "inspiration", "guide", "curiosity"],
  secondaryMin: 50,
  secondaryMax: 3,
  pillarWeights: {
    challenge: { challenge: 0.3, blind_spot: 0.25, mythbuster: 0.15, threat: 0.1, perspective: 0.1, signal: 0.05, trust: 0.05 },
    inspire: { solution: 0.25, opportunity: 0.22, guide: 0.2, inspiration: 0.18, signal: 0.05, perspective: 0.05, trust: 0.05 },
    understand: { perspective: 0.3, signal: 0.25, curiosity: 0.1, threat: 0.1, opportunity: 0.08, challenge: 0.07, trust: 0.1 },
  },
  pillarByFunction: { challenge: "challenge", blind_spot: "challenge", mythbuster: "challenge", threat: "challenge", solution: "inspire", opportunity: "inspire", guide: "inspire", inspiration: "inspire", perspective: "understand", signal: "understand", curiosity: "understand" },
  formatByFunction: {
    challenge: "Analyse eller afdækning med modstemmer", blind_spot: "Baggrund: det, ingen taler om", perspective: "Forklarende baggrundsartikel", mythbuster: "Faktatjek eller 'rigtigt/forkert'",
    signal: "Kort nyhed med fortsættelse", threat: "Varsel og konsekvensanalyse", opportunity: "Mulighedshistorie med konkrete næste skridt", inspiration: "Portræt eller case",
    guide: "Guide eller tjekliste", curiosity: "Fortælling eller forklarer", solution: "Løsningsorienteret reportage",
  },
  priorityByBand: { URGENT: "A", HIGH: "B", POTENTIAL: "C" },
};

export type ConfigValidation = { ok: true; config: ScoreConfig } | { ok: false; error: string };

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** Streng validering af en konfiguration fra Kontrolrummet. Alt skal være til stede og give mening, ellers afvises den. */
export function validateScoreConfig(raw: unknown): ConfigValidation {
  if (!isObj(raw)) return { ok: false, error: "Konfigurationen skal være et objekt." };

  const weights = {} as Record<DimensionId, number>;
  if (!isObj(raw.weights)) return { ok: false, error: "Vægtene mangler." };
  let sum = 0;
  for (const id of DIMENSION_IDS) {
    const w = num(raw.weights[id]);
    if (w === null || w < 0 || w > 1) return { ok: false, error: `Vægten for ${DIMENSION_LABEL[id].navn} skal være et tal mellem 0 og 1.` };
    weights[id] = w;
    sum += w;
  }
  if (Object.keys(raw.weights).some((k) => !(DIMENSION_IDS as readonly string[]).includes(k))) return { ok: false, error: "Vægtene indeholder en ukendt dimension." };
  if (Math.abs(sum - 1) > 0.001) return { ok: false, error: `Vægtene skal give 1,00 i alt (nu ${sum.toFixed(2).replace(".", ",")}).` };

  if (!Array.isArray(raw.thresholds) || raw.thresholds.length !== BANDS.length) return { ok: false, error: `Der skal være præcis ${BANDS.length} bånd.` };
  const thresholds: ScoreConfig["thresholds"] = [];
  for (const t of raw.thresholds) {
    if (!isObj(t) || num(t.min) === null || typeof t.band !== "string" || !(BANDS as readonly string[]).includes(t.band)) return { ok: false, error: "Et bånd er ugyldigt." };
    thresholds.push({ min: t.min as number, band: t.band as Band });
  }
  if (new Set(thresholds.map((t) => t.band)).size !== BANDS.length) return { ok: false, error: "Hvert bånd skal bruges én gang." };
  for (let i = 0; i < thresholds.length; i++) {
    if (thresholds[i].min < 0 || thresholds[i].min > 100) return { ok: false, error: "Grænserne skal ligge mellem 0 og 100." };
    if (i > 0 && thresholds[i].min >= thresholds[i - 1].min) return { ok: false, error: "Grænserne skal falde: højeste bånd først." };
  }
  if (thresholds[0].band !== "URGENT" || thresholds[thresholds.length - 1].band !== "IGNORE" || thresholds[thresholds.length - 1].min !== 0) return { ok: false, error: "Rækkefølgen skal være Kritisk, Høj, Værd at følge, Lav, Ignorér, og laveste grænse skal være 0." };

  if (!Array.isArray(raw.tiebreak) || raw.tiebreak.length !== FUNCTION_IDS.length || new Set(raw.tiebreak).size !== FUNCTION_IDS.length || raw.tiebreak.some((f) => !(FUNCTION_IDS as readonly string[]).includes(String(f)))) {
    return { ok: false, error: "Rækkefølgen ved lighed skal indeholde hver af de 11 funktioner præcis én gang." };
  }
  const secondaryMin = num(raw.secondaryMin);
  const secondaryMax = num(raw.secondaryMax);
  if (secondaryMin === null || secondaryMin < 0 || secondaryMin > 100) return { ok: false, error: "Grænsen for sekundære funktioner skal være 0-100." };
  if (secondaryMax === null || !Number.isInteger(secondaryMax) || secondaryMax < 0 || secondaryMax > 5) return { ok: false, error: "Antal sekundære funktioner skal være 0-5." };

  const pillarWeights = {} as ScoreConfig["pillarWeights"];
  if (!isObj(raw.pillarWeights)) return { ok: false, error: "Søjlevægtene mangler." };
  for (const p of PILLAR_IDS) {
    const row = raw.pillarWeights[p];
    if (!isObj(row)) return { ok: false, error: `Søjlen ${PILLAR_LABEL[p]} mangler vægte.` };
    const out: Partial<Record<FunctionId | "trust", number>> = {};
    let total = 0;
    for (const [k, v] of Object.entries(row)) {
      if (k !== "trust" && !(FUNCTION_IDS as readonly string[]).includes(k)) return { ok: false, error: `Søjlen ${PILLAR_LABEL[p]} bruger en ukendt funktion: ${k}.` };
      const w = num(v);
      if (w === null || w < 0 || w > 1) return { ok: false, error: `Vægten for ${k} i ${PILLAR_LABEL[p]} skal være 0-1.` };
      out[k as FunctionId | "trust"] = w;
      total += w;
    }
    if (Math.abs(total - 1) > 0.001) return { ok: false, error: `Vægtene i ${PILLAR_LABEL[p]} skal give 1,00 i alt (nu ${total.toFixed(2).replace(".", ",")}).` };
    pillarWeights[p] = out;
  }

  const pillarByFunction = {} as ScoreConfig["pillarByFunction"];
  const formatByFunction = {} as ScoreConfig["formatByFunction"];
  if (!isObj(raw.pillarByFunction) || !isObj(raw.formatByFunction)) return { ok: false, error: "Søjle og anbefalet format mangler for funktionerne." };
  for (const f of FUNCTION_IDS) {
    const p = raw.pillarByFunction[f];
    const fmt = raw.formatByFunction[f];
    if (typeof p !== "string" || !(PILLAR_IDS as readonly string[]).includes(p)) return { ok: false, error: `Søjle mangler for ${FUNCTION_LABEL[f]}.` };
    if (typeof fmt !== "string" || fmt.trim().length < 3 || fmt.length > 120) return { ok: false, error: `Anbefalet format for ${FUNCTION_LABEL[f]} skal være 3-120 tegn.` };
    pillarByFunction[f] = p as PillarId;
    formatByFunction[f] = fmt.trim();
  }

  const priorityByBand: ScoreConfig["priorityByBand"] = {};
  if (raw.priorityByBand !== undefined) {
    if (!isObj(raw.priorityByBand)) return { ok: false, error: "Prioritet pr. bånd er ugyldig." };
    for (const [band, prio] of Object.entries(raw.priorityByBand)) {
      if (!(BANDS as readonly string[]).includes(band) || (prio !== "A" && prio !== "B" && prio !== "C")) return { ok: false, error: "Prioritet pr. bånd er ugyldig." };
      priorityByBand[band as Band] = prio;
    }
  }
  return { ok: true, config: { weights, thresholds, tiebreak: raw.tiebreak as FunctionId[], secondaryMin, secondaryMax, pillarWeights, pillarByFunction, formatByFunction, priorityByBand } };
}

export function parseScoreConfigText(text: string): ConfigValidation {
  try {
    return validateScoreConfig(JSON.parse(text));
  } catch {
    return { ok: false, error: "Konfigurationen er ikke gyldig JSON." };
  }
}

export const stringifyScoreConfig = (config: ScoreConfig) => JSON.stringify(config, null, 2);
