/**
 * Register over alle prompts, der kan ses og tilrettes i kontrolrummet. KLIENT-SIKKERT (ingen database).
 * En prompt findes kun i kontrolrummet, hvis den står her: ukendte nøgler afvises, så ingen kan gemme tekst under en
 * nøgle, koden aldrig læser. Sikkerhedsreglerne og svarformatet er bevidst IKKE i registeret som redigerbare felter.
 */
import { EDITORIAL_SAFETY, GRUNDLAG_DEFAULTS, GRUNDLAG_EXAMPLES, GRUNDLAG_PARTS, GRUNDLAG_TITLES, LAYER_DEFAULTS, LAYER_EXAMPLES, LAYER_TASKS, STYLE_DEFAULT, TASK_DEFAULTS } from "./defaults";
import { GENERATOR_COMMON_KEY, generatorKey, grundlagKey, layerKey, promptKeyForTask, STYLE_KEY } from "./compose";
import { GENERATOR_COMMON_DEFAULT, GENERATOR_PROFILE_DEFAULTS, GENERATOR_SHAPE } from "./generator-defaults";
import { SCORE_CONFIG_KEY, SCORE_PROMPT_KEY } from "./compose";
import { SCORE_INSTRUCTION_DEFAULT, SCORE_SHAPE } from "./score-defaults";
import { DEFAULT_SCORE_CONFIG, parseScoreConfigText, stringifyScoreConfig } from "../score/config";
import { PROFILE_IDS, PROFILES, type ProfileId } from "../generate/types";
import { EDITORIAL_TASKS, TASK_INFO, type EditorialTask } from "../ai/editorial-schemas";

export type PromptKind = "grundlag" | "sprog" | "opgave" | "generator" | "rating";

export type PromptDef = {
  noegle: string;
  kind: PromptKind;
  titel: string;
  /** Hvad den gør, og hvor den bruges. */
  beskrivelse: string;
  /** Standardteksten (det, der gælder, til redaktionen tilretter noget). */
  standard: string;
  /** Kodens låste del, der vises skrivebeskyttet ved siden af (svarformat). */
  laast: string | null;
  minTegn: number;
  maxTegn: number;
  /** Forslag til tekst, hvis standarden er tom (tillægslag). */
  eksempel?: string;
  opgave?: EditorialTask;
  /** Generatorprofil (kun kind "generator"; udeladt for de fælles regler). */
  profil?: ProfileId;
  /** Ekstra validering af teksten (fx at en konfiguration er gyldig). Returnerer en fejltekst eller null. */
  tjek?: (tekst: string) => string | null;
};

export const KIND_LABEL: Record<PromptKind, string> = {
  grundlag: "Redaktionelt grundlag",
  sprog: "Sprog og stil",
  opgave: "Opgaver i skrivearbejdet",
  generator: "Artikelgenerator",
  rating: "Ratingscore",
};

const TASK_DESCRIPTION: Record<EditorialTask, string> = {
  headlines: "Foreslår 3-5 overskrifter. Bruges i artikel-editoren og Production Engine.",
  subheading: "Skriver en underrubrik (manchet).",
  slug: "Foreslår URL-slug.",
  seo: "Skriver SEO-titel og metabeskrivelse.",
  og: "Skriver tekster til deling (Open Graph og X).",
  social: "Skriver opslag til sociale medier pr. platform.",
  tagsGeo: "Foreslår emne-tags og områder fra de eksisterende lister.",
  altText: "Foreslår alt-tekst og billedtekst ud fra filnavn og kontekst.",
  summary: "Skriver resumé (TL;DR) og punkter.",
  improve: "Forbedrer, omskriver, forkorter eller udvider en tekst.",
  factcheck: "Markerer udsagn grøn/gul/rød mod de givne kilder og deres uddrag.",
  seoComment: "Kommenterer den deterministiske SEO-score og prioriterer forbedringer.",
  publishTime: "Foreslår udgivelsestidspunkter.",
  headlineRating: "Vurderer en rubrik 0-100 mod teksten med delscorer. Ingen læsertal eller klikrate.",
  sourceRating: "Vurderer en kilde 0-100 ud fra de givne oplysninger. Forslag til kilderegisteret; redaktøren beslutter.",
};

const LAYER_TITLES: Record<keyof typeof LAYER_DEFAULTS, { titel: string; beskrivelse: string }> = {
  rubrikker: { titel: "Rubrikregler", beskrivelse: "Faste regler for overskrifter, underrubrikker, SEO- og delingstekster. Tilføjes til opgaverne: " },
  some: { titel: "Tone på sociale medier", beskrivelse: "Fast tone og regler for opslagstekster. Tilføjes til opgaven: " },
};

function build(): PromptDef[] {
  const defs: PromptDef[] = [
    {
      noegle: STYLE_KEY,
      kind: "sprog",
      titel: "Sprog og stil (grundtone)",
      beskrivelse: "Redaktionens skrivestil. Gælder ALLE AI-opgaver (indgår i systemprompten, efter de låste sikkerhedsregler).",
      standard: STYLE_DEFAULT,
      laast: EDITORIAL_SAFETY,
      minTegn: 30,
      maxTegn: 2000,
    },
  ];
  const grundlag: PromptDef[] = [];
  for (const part of GRUNDLAG_PARTS) {
    grundlag.push({
      noegle: grundlagKey(part),
      kind: "grundlag",
      titel: GRUNDLAG_TITLES[part].titel,
      beskrivelse: `${GRUNDLAG_TITLES[part].beskrivelse} Gælder alle AI-opgaver. Tom som standard.`,
      standard: GRUNDLAG_DEFAULTS[part],
      laast: null,
      minTegn: 0,
      maxTegn: 2500,
      eksempel: GRUNDLAG_EXAMPLES[part],
    });
  }
  defs.unshift(...grundlag);
  defs.push({
    noegle: GENERATOR_COMMON_KEY,
    kind: "generator",
    titel: "Generator: fælles regler",
    beskrivelse: "Regler for kilder, citater, skrift og metadata, der gælder alle profiler, når en hel artikel genereres ud fra feeds og originalkilder.",
    standard: GENERATOR_COMMON_DEFAULT,
    laast: GENERATOR_SHAPE,
    minTegn: 100,
    maxTegn: 4000,
  });
  for (const profil of PROFILE_IDS) {
    defs.push({
      noegle: generatorKey(profil),
      kind: "generator",
      titel: `Generator: ${PROFILES[profil].titel}`,
      beskrivelse: `${PROFILES[profil].beskrivelse} Lægges oven på de fælles regler.`,
      standard: GENERATOR_PROFILE_DEFAULTS[profil],
      laast: GENERATOR_SHAPE,
      minTegn: 30,
      maxTegn: 3000,
      profil,
    });
  }
  for (const layer of Object.keys(LAYER_DEFAULTS) as Array<keyof typeof LAYER_DEFAULTS>) {
    defs.push({
      noegle: layerKey(layer),
      kind: "sprog",
      titel: LAYER_TITLES[layer].titel,
      beskrivelse: `${LAYER_TITLES[layer].beskrivelse}${LAYER_TASKS[layer].map((t) => TASK_INFO[t as EditorialTask].label).join(", ")}. Tom som standard.`,
      standard: LAYER_DEFAULTS[layer],
      laast: null,
      minTegn: 0,
      maxTegn: 1500,
      eksempel: LAYER_EXAMPLES[layer],
    });
  }
  for (const task of EDITORIAL_TASKS) {
    const rating = task === "headlineRating" || task === "sourceRating";
    defs.push({
      noegle: promptKeyForTask(task),
      kind: rating ? "rating" : "opgave",
      titel: TASK_INFO[task].label,
      beskrivelse: TASK_DESCRIPTION[task],
      standard: TASK_DEFAULTS[task].instruction,
      laast: TASK_DEFAULTS[task].shape,
      minTegn: 20,
      maxTegn: 3000,
      opgave: task,
    });
  }
  defs.push(
    {
      noegle: SCORE_PROMPT_KEY,
      kind: "rating",
      titel: "Local Score: vurdering af signaler",
      beskrivelse: "Instruktionen til AI, når et signal vurderes på 7 dimensioner og 11 journalistiske funktioner. AI estimerer kun delscorer; totalen beregnes af systemet.",
      standard: SCORE_INSTRUCTION_DEFAULT,
      laast: SCORE_SHAPE,
      minTegn: 100,
      maxTegn: 5000,
    },
    {
      noegle: SCORE_CONFIG_KEY,
      kind: "rating",
      titel: "Local Score: vægte, bånd og søjler",
      beskrivelse: "Vægtene for de 7 dimensioner, grænserne mellem bånd, rækkefølgen ved lighed og søjlerne. Redigeres på siden Local Score. Ændringer slår igennem på alle eksisterende vurderinger uden nyt AI-kald.",
      standard: stringifyScoreConfig(DEFAULT_SCORE_CONFIG),
      laast: null,
      minTegn: 200,
      maxTegn: 8000,
      tjek: (tekst) => {
        const res = parseScoreConfigText(tekst);
        return res.ok ? null : res.error;
      },
    },
  );
  return defs;
}

export const PROMPT_DEFS: readonly PromptDef[] = build();

const BY_KEY = new Map(PROMPT_DEFS.map((d) => [d.noegle, d]));

export function getPromptDef(noegle: string): PromptDef | undefined {
  return BY_KEY.get(noegle);
}

export function isPromptKey(noegle: string): boolean {
  return BY_KEY.has(noegle);
}

export type PromptValidation = { ok: true; tekst: string } | { ok: false; error: string };

/** Rens og valider en tilrettet prompttekst. Beskytter datakonvolutten og kodens låste dele. */
export function validatePromptText(def: PromptDef, raw: string): PromptValidation {
  const tekst = raw
    .replace(/\r\n?/g, "\n")
    .replace(/[^\S\n\t ]+/g, " ")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
  if (tekst.length < def.minTegn) return { ok: false, error: def.minTegn === 0 ? "Teksten må ikke være tom." : `Skriv mindst ${def.minTegn} tegn.` };
  if (tekst.length > def.maxTegn) return { ok: false, error: `Højst ${def.maxTegn} tegn (nu ${tekst.length}).` };
  if (/<\s*\/?\s*data\b/i.test(tekst)) return { ok: false, error: "Teksten må ikke indeholde <data>-mærker: de bruges til at holde indhold adskilt fra instruktioner." };
  const extra = def.tjek?.(tekst);
  if (extra) return { ok: false, error: extra };
  if (def.noegle !== SCORE_CONFIG_KEY && /svarformat\s*\(kun json\)/i.test(tekst)) return { ok: false, error: "Svarformatet er låst i koden og kan ikke tilrettes her." };
  return { ok: true, tekst };
}
