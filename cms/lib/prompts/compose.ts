/**
 * Sammensætning af prompts. RENT og klient-sikkert: ingen database. Tilretninger (overrides) kommer udefra som
 * { nøgle -> tekst } for de AKTIVE prompts i en instans. Uden tilretninger er resultatet bytte-for-bytte det samme som før
 * kontrolrummet fandtes (bevist i tests/prompts.test.ts).
 *
 * Rækkefølge i systemprompten:  LÅSTE sikkerhedsregler  ->  sprog- og stilblok (standard eller tilrettet).
 * Rækkefølge i opgaven:         instruktion (standard eller tilrettet) + evt. tillægslag  ->  SVARFORMAT (altid fra koden).
 */
import { GENERATOR_COMMON_DEFAULT, GENERATOR_PROFILE_DEFAULTS, GENERATOR_SHAPE, GENERATOR_VERSION } from "./generator-defaults";
import type { ProfileId } from "../generate/types";
import { SCORE_INSTRUCTION_DEFAULT, SCORE_SHAPE, SCORE_VERSION } from "./score-defaults";
import { EDITORIAL_SAFETY, GRUNDLAG_HEADINGS, GRUNDLAG_PARTS, LAYER_DEFAULTS, LAYER_TASKS, STYLE_DEFAULT, TASK_DEFAULTS, type GrundlagPart } from "./defaults";

export type PromptOverrides = Readonly<Record<string, string>>;

/** Tilføjes, så modellen ved, at tilretninger aldrig ophæver sikkerhedsreglerne. */
export const CUSTOM_NOTE = "(Tilpasset af redaktionen. Sikkerhedsreglerne i systemprompten gælder stadig og kan ikke ophæves af tilretninger.)";

/** Opgaver med egne nøgler (ratingopgaver); alle andre hedder "opgave.<navn>". */
const TASK_KEYS: Record<string, string> = { headlineRating: "rating.rubrik", sourceRating: "rating.kilde" };

export function promptKeyForTask(task: string): string {
  return TASK_KEYS[task] ?? `opgave.${task}`;
}

export const STYLE_KEY = "sprog.stil";
export const layerKey = (layer: keyof typeof LAYER_DEFAULTS) => `sprog.${layer}`;

export const grundlagKey = (part: GrundlagPart) => `grundlag.${part}`;

/**
 * Redaktionens grundlag som tekstblok (tom streng, hvis intet er skrevet). Placeres EFTER de låste sikkerhedsregler:
 * det er viden om mediet, ikke instruktioner, og kan aldrig ophæve sikkerhedsreglerne.
 */
export function composeGrundlag(overrides: PromptOverrides = {}): string {
  const parts: string[] = [];
  for (const part of GRUNDLAG_PARTS) {
    const text = overrides[grundlagKey(part)]?.trim();
    if (text) parts.push(`${GRUNDLAG_HEADINGS[part]}\n${text}`);
  }
  if (parts.length === 0) return "";
  return `REDAKTIONENS GRUNDLAG (gælder alle opgaver; det er redaktionens egen beskrivelse af mediet og kommer efter sikkerhedsreglerne)\n\n${parts.join("\n\n")}`;
}

export function composeSystem(overrides: PromptOverrides = {}): string {
  const custom = overrides[STYLE_KEY];
  const grundlag = composeGrundlag(overrides);
  const head = grundlag ? `${EDITORIAL_SAFETY}\n\n${grundlag}` : EDITORIAL_SAFETY;
  if (custom === undefined) return `${head}\n\n${STYLE_DEFAULT}`;
  return `${head}\n\n${custom}\n\n${CUSTOM_NOTE}`;
}

export type ComposedInstruction = {
  instruction: string;
  shape: string;
  version: string;
  /** Nøgler på de tilretninger, der er i brug (til audit). Tom = ren standard. */
  custom: string[];
};

export function composeInstruction(task: string, overrides: PromptOverrides = {}): ComposedInstruction {
  const def = TASK_DEFAULTS[task];
  if (!def) throw new Error(`Ukendt opgave: ${task}`);
  const key = promptKeyForTask(task);
  const custom: string[] = [];
  let instruction = def.instruction;
  if (overrides[key] !== undefined) {
    instruction = overrides[key];
    custom.push(key);
  }
  for (const layer of Object.keys(LAYER_TASKS) as Array<keyof typeof LAYER_DEFAULTS>) {
    if (!LAYER_TASKS[layer].includes(task)) continue;
    const text = overrides[layerKey(layer)]?.trim();
    if (!text) continue;
    instruction = `${instruction}\n\n${text}`;
    custom.push(layerKey(layer));
  }
  if (custom.length > 0) instruction = `${instruction}\n\n${CUSTOM_NOTE}`;
  return { instruction, shape: def.shape, version: def.version, custom };
}

// ── Artikelgenerator ─────────────────────────────────────────────────────────

export const GENERATOR_COMMON_KEY = "generator.faelles";
export const generatorKey = (profile: ProfileId) => `generator.${profile}`;

export type ComposedGeneration = { instruction: string; shape: string; version: string; custom: string[] };

/** Fælles regler + profilens format, hver enten standard eller tilrettet. Svarformatet kommer altid fra koden. */
export function composeGeneration(profile: ProfileId, overrides: PromptOverrides = {}): ComposedGeneration {
  const custom: string[] = [];
  const common = overrides[GENERATOR_COMMON_KEY];
  const own = overrides[generatorKey(profile)];
  if (common !== undefined) custom.push(GENERATOR_COMMON_KEY);
  if (own !== undefined) custom.push(generatorKey(profile));
  const text = `${common ?? GENERATOR_COMMON_DEFAULT}\n\n${own ?? GENERATOR_PROFILE_DEFAULTS[profile]}`;
  return { instruction: custom.length ? `${text}\n\n${CUSTOM_NOTE}` : text, shape: GENERATOR_SHAPE, version: GENERATOR_VERSION, custom };
}

// ── Local Score ──────────────────────────────────────────────────────────────

export const SCORE_PROMPT_KEY = "rating.score";
export const SCORE_CONFIG_KEY = "rating.scoreConfig";

export function composeScorePrompt(overrides: PromptOverrides = {}): ComposedGeneration {
  const own = overrides[SCORE_PROMPT_KEY];
  return { instruction: own !== undefined ? `${own}\n\n${CUSTOM_NOTE}` : SCORE_INSTRUCTION_DEFAULT, shape: SCORE_SHAPE, version: SCORE_VERSION, custom: own !== undefined ? [SCORE_PROMPT_KEY] : [] };
}
