/**
 * AI i artikelarbejdet: opgaver, resultat-skemaer og governance-metadata. KLIENT-SIKKER (ingen SDK/DB/Next) — bruges både
 * af editoren (knapper, "Anvend/Kassér"-chips, auto-mærkning) og af serversiden (lib/ai/editorial.ts).
 *
 * Alle AI-resultater er FORSLAG: intet gemmes, mærkes eller publiceres uden redaktørens klik.
 */
import { z } from "zod";
import { checkPost, normalizeHashtag, SOCIAL_PLATFORMS, type SocialPlatform } from "../article-meta";

export const EDITORIAL_TASKS = [
  "headlines",
  "subheading",
  "slug",
  "seo",
  "og",
  "social",
  "tagsGeo",
  "altText",
  "summary",
  "improve",
  "factcheck",
  "seoComment",
  "publishTime",
  "headlineRating",
  "sourceRating",
] as const;
export type EditorialTask = (typeof EDITORIAL_TASKS)[number];

export type TaskInfo = {
  label: string;
  /** Tekstgenererende: spærret i Krimi og retsvæsen/Sundhed, og accept registrerer AI-brug i `aiBrug`. */
  textGenerating: boolean;
  /** AI-brug (jf. lib/marking.ts) der føjes til aiBrug når redaktøren accepterer forslaget; null = metadata (ingen mærkning). */
  aiUse: "Udkast" | "Omskrivning" | null;
  /** Kræver at artiklen har brødtekst. */
  needsBody: boolean;
};

export const TASK_INFO: Record<EditorialTask, TaskInfo> = {
  headlines: { label: "Overskriftsvarianter", textGenerating: true, aiUse: "Udkast", needsBody: true },
  subheading: { label: "Underrubrik", textGenerating: true, aiUse: "Udkast", needsBody: true },
  slug: { label: "Slug", textGenerating: false, aiUse: null, needsBody: false },
  seo: { label: "SEO-titel og metabeskrivelse", textGenerating: false, aiUse: null, needsBody: true },
  og: { label: "OG- og Twitter-tekster", textGenerating: false, aiUse: null, needsBody: true },
  social: { label: "Opslagstekster", textGenerating: false, aiUse: null, needsBody: true },
  tagsGeo: { label: "Tags og områder", textGenerating: false, aiUse: null, needsBody: true },
  altText: { label: "Alt-tekst og billedtekst", textGenerating: false, aiUse: null, needsBody: false },
  summary: { label: "Resumé / TL;DR", textGenerating: true, aiUse: "Udkast", needsBody: true },
  improve: { label: "Forbedr tekst", textGenerating: true, aiUse: "Omskrivning", needsBody: true },
  factcheck: { label: "Faktatjek-markering", textGenerating: false, aiUse: null, needsBody: true },
  seoComment: { label: "SEO-kommentar", textGenerating: false, aiUse: null, needsBody: false },
  publishTime: { label: "Udgivelsestidspunkt", textGenerating: false, aiUse: null, needsBody: false },
  // Ratingopgaver foreslår kun en score med begrundelse; de genererer ingen artikeltekst og kan bruges i alle sektioner.
  headlineRating: { label: "Rubrik-score", textGenerating: false, aiUse: null, needsBody: true },
  sourceRating: { label: "Kildevurdering", textGenerating: false, aiUse: null, needsBody: false },
};

export function isTextGeneratingTask(task: EditorialTask): boolean {
  return TASK_INFO[task].textGenerating;
}
/** AI-brug der skal registreres når et forslag til `task` accepteres (null = metadata, ingen mærkning i aiBrug). */
export function aiUseForTask(task: EditorialTask): "Udkast" | "Omskrivning" | null {
  return TASK_INFO[task].aiUse;
}

/** Hvad sker der i `aiBrug` når et forslag accepteres? (ren funktion, delt med editoren) */
export function applyAcceptedAiUse(current: readonly string[], task: EditorialTask): string[] {
  const use = aiUseForTask(task);
  if (!use) return [...current];
  const withoutNone = current.filter((v) => v !== "Ingen");
  return withoutNone.includes(use) ? withoutNone : [...withoutNone, use];
}

// ── Resultat-skemaer ────────────────────────────────────────────────────────

const clean = (max: number, min = 1) => z.string().trim().min(min).max(max);

export const headlinesSchema = z.object({
  varianter: z.array(z.object({ titel: clean(110, 8), begrundelse: clean(240).optional() })).min(3).max(5),
  abPar: z.object({ a: clean(110, 8), b: clean(110, 8) }).optional(),
});
export type HeadlinesResult = z.infer<typeof headlinesSchema>;

export const subheadingSchema = z.object({ manchet: clean(220, 20) });
export type SubheadingResult = z.infer<typeof subheadingSchema>;

export const slugSchema = z.object({ slug: clean(80, 3) });
export type SlugResult = z.infer<typeof slugSchema>;

export const seoSchema = z.object({ seoTitel: clean(60, 15), seoBeskrivelse: clean(155, 50) });
export type SeoResult = z.infer<typeof seoSchema>;

export const ogSchema = z.object({
  ogTitel: clean(95, 10),
  ogBeskrivelse: clean(200, 20),
  twitterTitel: clean(70, 10),
  twitterBeskrivelse: clean(200, 20),
});
export type OgResult = z.infer<typeof ogSchema>;

const hashtags = z.array(z.string()).max(30).default([]).transform((l) => l.map(normalizeHashtag).filter(Boolean));

export const socialSchema = z
  .object({
    opslag: z.partialRecord(z.enum(SOCIAL_PLATFORMS), z.object({ tekst: z.string().trim().min(1).max(6000), hashtags })),
  })
  .superRefine((value, ctx) => {
    for (const platform of Object.keys(value.opslag) as SocialPlatform[]) {
      const post = value.opslag[platform];
      if (!post) continue;
      // Længden måles inkl. et link (X: 23 tegn), så et forslag der passer her også passer med artikel-linket tilføjet.
      const check = checkPost(platform, { tekst: post.tekst, hashtags: post.hashtags, link: "https://example.dk/x" });
      for (const message of check.errors) ctx.addIssue({ code: "custom", message, path: ["opslag", platform] });
    }
  });
export type SocialResult = z.infer<typeof socialSchema>;

export const tagsGeoSchema = z.object({
  tags: z.array(clean(60)).max(12).default([]),
  geo: z.array(clean(60)).max(8).default([]),
});
export type TagsGeoResult = z.infer<typeof tagsGeoSchema>;
/** Resultat efter at forslagene er afstemt med de eksisterende lister (serveren). */
export type TagsGeoSuggestion = { eksisterendeTags: string[]; nyeTags: string[]; eksisterendeGeo: string[]; nyeGeo: string[] };

export const altTextSchema = z.object({ altTekst: clean(125, 5), billedtekst: clean(220).optional() });
export type AltTextResult = z.infer<typeof altTextSchema>;

export const summarySchema = z.object({ tldr: clean(320, 30), punkter: z.array(clean(200)).min(2).max(5) });
export type SummaryResult = z.infer<typeof summarySchema>;

export const IMPROVE_MODES = ["forbedr", "omskriv", "forkort", "udvid"] as const;
export type ImproveMode = (typeof IMPROVE_MODES)[number];
export const improveSchema = z.object({ tekst: z.string().trim().min(1).max(20000), noter: clean(300).optional() });
export type ImproveResult = z.infer<typeof improveSchema>;

export const FACTCHECK_STATUS = ["groen", "gul", "roed"] as const;
export type FactcheckStatus = (typeof FACTCHECK_STATUS)[number];
export const factcheckSchema = z.object({
  markeringer: z
    .array(
      z.object({
        udsagn: clean(300),
        status: z.enum(FACTCHECK_STATUS),
        begrundelse: clean(400),
        /** 1-baseret nummer på en GIVET kilde; kræves for grøn. */
        kilde: z.number().int().min(1).max(50).nullish().transform((v) => v ?? null),
      }),
    )
    .max(25),
});
export type FactcheckResult = z.infer<typeof factcheckSchema>;

export const seoCommentSchema = z.object({ kommentar: clean(700, 20), prioriteter: z.array(clean(200)).max(5).default([]) });
export type SeoCommentResult = z.infer<typeof seoCommentSchema>;

export const publishTimeSchema = z.object({
  forslag: z
    .array(z.object({ tidspunkt: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Tidspunkt som HH:MM."), dagsdel: clean(40), begrundelse: clean(240) }))
    .min(1)
    .max(3),
  note: clean(240).optional(),
});
export type PublishTimeResult = z.infer<typeof publishTimeSchema>;

/** Hel score 0-100 (modellen svarer nogle gange med decimaler). */
const score100 = z.number().min(0).max(100).transform((n) => Math.round(n));

export const headlineRatingSchema = z.object({
  score: score100,
  delscorer: z.array(z.object({ kriterium: clean(60), score: score100, kommentar: clean(240) })).min(3).max(6),
  begrundelse: clean(500),
  forbedring: clean(240).nullish().transform((v) => v ?? undefined),
});
export type HeadlineRatingResult = z.infer<typeof headlineRatingSchema>;

export const SOURCE_FACTOR_ASSESSMENTS = ["positiv", "neutral", "negativ"] as const;
export const sourceRatingSchema = z.object({
  score: score100,
  faktorer: z.array(z.object({ faktor: clean(60), vurdering: z.enum(SOURCE_FACTOR_ASSESSMENTS), kommentar: clean(240) })).min(3).max(6),
  begrundelse: clean(500),
});
export type SourceRatingResult = z.infer<typeof sourceRatingSchema>;

export const TASK_SCHEMAS = {
  headlines: headlinesSchema,
  subheading: subheadingSchema,
  slug: slugSchema,
  seo: seoSchema,
  og: ogSchema,
  social: socialSchema,
  tagsGeo: tagsGeoSchema,
  altText: altTextSchema,
  summary: summarySchema,
  improve: improveSchema,
  factcheck: factcheckSchema,
  seoComment: seoCommentSchema,
  publishTime: publishTimeSchema,
  headlineRating: headlineRatingSchema,
  sourceRating: sourceRatingSchema,
} as const;

export type TaskResult = {
  headlines: HeadlinesResult;
  subheading: SubheadingResult;
  slug: SlugResult;
  seo: SeoResult;
  og: OgResult;
  social: SocialResult;
  tagsGeo: TagsGeoSuggestion;
  altText: AltTextResult;
  summary: SummaryResult;
  improve: ImproveResult;
  factcheck: FactcheckResult;
  seoComment: SeoCommentResult;
  publishTime: PublishTimeResult;
  headlineRating: HeadlineRatingResult;
  sourceRating: SourceRatingResult;
};

// ── Forespørgsel (delt mellem route, service og klient) ─────────────────────

export const MAX_BODY_CHARS = 30_000;
export const MAX_SOURCES = 20;
/** Uddrag fra originalkilder, der sendes med til faktatjek: pr. kilde og samlet. */
export const MAX_EXCERPT_CHARS = 3000;
export const MAX_EXCERPTS_TOTAL = 24_000;

export const editorialRequestSchema = z.object({
  task: z.enum(EDITORIAL_TASKS),
  articleId: z.string().max(60).nullish(),
  context: z.object({
    titel: z.string().max(400).default(""),
    manchet: z.string().max(600).default(""),
    brodtekst: z.string().max(MAX_BODY_CHARS).default(""),
    kategoriId: z.string().max(60).nullish(),
    geoTagIds: z.array(z.string().max(60)).max(30).default([]),
    tagIds: z.array(z.string().max(60)).max(60).default([]),
    sprog: z.string().max(10).default("da"),
    kilder: z.array(z.object({ titel: z.string().max(200), url: z.string().max(500).nullish(), udgiver: z.string().max(120).nullish(), uddrag: z.string().max(MAX_EXCERPT_CHARS).nullish() })).max(MAX_SOURCES).default([]),
  }),
  params: z
    .object({
      platforms: z.array(z.enum(SOCIAL_PLATFORMS)).max(5).optional(),
      mode: z.enum(IMPROVE_MODES).optional(),
      /** improve: den tekst der skal forbedres (afsnit/markering). */
      text: z.string().max(MAX_BODY_CHARS).optional(),
      /** altText: billedets kontekst (filnavn, eksisterende billedtekst, kredit). */
      image: z.object({ filnavn: z.string().max(200).nullish(), billedtekst: z.string().max(400).nullish(), ophavsperson: z.string().max(200).nullish() }).optional(),
      /** seoComment: den deterministiske score der kommenteres. */
      score: z.object({ score: z.number(), items: z.array(z.object({ label: z.string().max(80), status: z.string().max(10), hint: z.string().max(400) })).max(30) }).optional(),
      /** publishTime: ugedag/dagsdel brugeren overvejer (valgfrit). */
      weekday: z.string().max(20).optional(),
      /** sourceRating: den kilde der vurderes (navn, url, type og et uddrag af dens tekst). */
      kilde: z.object({ navn: z.string().max(200).nullish(), url: z.string().max(500).nullish(), type: z.string().max(40).nullish(), uddrag: z.string().max(4000).nullish() }).optional(),
    })
    .default({}),
}).superRefine((value, ctx) => {
  const total = value.context.kilder.reduce((n, k) => n + (k.uddrag?.length ?? 0), 0);
  if (total > MAX_EXCERPTS_TOTAL) ctx.addIssue({ code: "too_big", maximum: MAX_EXCERPTS_TOTAL, origin: "string", message: "For mange kildeuddrag samlet.", path: ["context", "kilder"] });
});
export type EditorialRequest = z.input<typeof editorialRequestSchema>;
export type EditorialRequestParsed = z.output<typeof editorialRequestSchema>;

export type EditorialResponse<T extends EditorialTask = EditorialTask> =
  | { ok: true; task: T; suggestion: TaskResult[T]; promptVersion: string; modelId: string; /** Registrér denne AI-brug hvis forslaget accepteres (null = metadata). */ aiUse: "Udkast" | "Omskrivning" | null }
  | { ok: false; code: "ingen-noegle" | "forbudt" | "ugyldig" | "for-stor" | "rate" | "ai-fejl" | "ingen-tekst"; error: string };
