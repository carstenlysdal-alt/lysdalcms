/**
 * Sammensætning af prompts. RENT og klient-sikkert: ingen database. Tilretninger (overrides) kommer udefra som
 * { nøgle -> tekst } for de AKTIVE prompts i en instans. Uden tilretninger er resultatet bytte-for-bytte det samme som før
 * kontrolrummet fandtes (bevist i tests/prompts.test.ts).
 *
 * Rækkefølge i systemprompten:  LÅSTE sikkerhedsregler  ->  sprog- og stilblok (standard eller tilrettet).
 * Rækkefølge i opgaven:         instruktion (standard eller tilrettet) + evt. tillægslag  ->  SVARFORMAT (altid fra koden).
 */
import { EDITORIAL_SAFETY, LAYER_DEFAULTS, LAYER_TASKS, STYLE_DEFAULT, TASK_DEFAULTS } from "./defaults";

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

export function composeSystem(overrides: PromptOverrides = {}): string {
  const custom = overrides[STYLE_KEY];
  if (custom === undefined) return `${EDITORIAL_SAFETY}\n\n${STYLE_DEFAULT}`;
  return `${EDITORIAL_SAFETY}\n\n${custom}\n\n${CUSTOM_NOTE}`;
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
