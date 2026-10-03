/**
 * Udvidet artikelmetadata (ArticleMeta): zod-skema, platformsgrænser for opslagstekster, normalisering og
 * omsætning mellem formular/JSON og databaserække. Ren logik uden Next/Prisma-runtime (testbar med node --test).
 *
 * Se docs/design/METADATA-OG-SOME.md for hvert felts redigeringssted, offentlige brug og fallbacks.
 */
import { z } from "zod";

// ── Opslagstekster pr. platform ─────────────────────────────────────────────

export const SOCIAL_PLATFORMS = ["facebook", "instagram", "linkedin", "x", "bluesky"] as const;
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

export type PlatformSpec = {
  label: string;
  /** Hård grænse vi validerer i app-laget (tegn/grafemer inkl. hashtags og evt. link). */
  max: number;
  /** Anbefalet længde (blød advarsel i editoren). */
  recommended: number;
  /** Max antal hashtags. */
  maxHashtags: number;
  /** Anbefalet antal hashtags (blød). */
  recommendedHashtags: number;
  /** X tæller et link som fast 23 tegn uanset længde. */
  linkLength?: number;
  /** Links er ikke klikbare i billedtekster (Instagram) og tælles/udsendes derfor ikke. */
  linkInline: boolean;
  /** Tone-vejledning, også brugt som AI-instruks. */
  tone: string;
};

export const PLATFORM_SPECS: Record<SocialPlatform, PlatformSpec> = {
  facebook: {
    label: "Facebook",
    // Teknisk grænse er 63.206 tegn; vi begrænser til 5.000 af redaktionelle grunde (ingen læser mere).
    max: 5000,
    recommended: 480,
    maxHashtags: 10,
    recommendedHashtags: 3,
    linkInline: true,
    tone: "Venlig, lokal og nysgerrig. Åbn med det vigtigste. Stil gerne et spørgsmål. Højst 2-3 hashtags.",
  },
  instagram: {
    label: "Instagram",
    max: 2200,
    recommended: 300,
    maxHashtags: 30,
    recommendedHashtags: 8,
    linkInline: false,
    tone: "Visuel og personlig. Første linje fanger (kun ca. 125 tegn vises). Link står i bio, ikke i teksten. Brug 5-10 relevante hashtags.",
  },
  linkedin: {
    label: "LinkedIn",
    max: 3000,
    recommended: 700,
    maxHashtags: 5,
    recommendedHashtags: 3,
    linkInline: true,
    tone: "Sagligt og perspektiverende. Fremhæv betydning for erhverv, kommune og samfund. Højst 3-5 hashtags.",
  },
  x: {
    label: "X",
    max: 280,
    recommended: 250,
    maxHashtags: 3,
    recommendedHashtags: 2,
    linkLength: 23,
    linkInline: true,
    tone: "Kort, skarp og nyhedsagtig. Det vigtigste først. Højst 1-2 hashtags. Samlet højst 280 tegn; et link tæller 23.",
  },
  bluesky: {
    label: "Bluesky",
    max: 300,
    recommended: 280,
    maxHashtags: 3,
    recommendedHashtags: 2,
    linkInline: true,
    tone: "Kort og samtalepræget. Højst 300 tegn (grafemer) inkl. hashtags og link. Få hashtags.",
  },
};

export type SocialUtm = { source: string; medium: string; campaign: string };
export type SocialPost = { tekst: string; hashtags: string[]; link?: string | null; utm?: SocialUtm };
export type SocialMap = Partial<Record<SocialPlatform, SocialPost>>;

export function normalizeHashtag(raw: string): string {
  return raw.trim().replace(/^#+/, "").replace(/\s+/g, "");
}

function normalizeHashtags(list: readonly string[]): string[] {
  const out: string[] = [];
  for (const raw of list) {
    const tag = normalizeHashtag(String(raw));
    if (tag && /^[\p{L}\p{N}_]{1,60}$/u.test(tag) && !out.some((t) => t.toLowerCase() === tag.toLowerCase())) out.push(tag);
  }
  return out;
}

const segmenter: { segment(input: string): Iterable<unknown> } | null =
  typeof Intl !== "undefined" && "Segmenter" in Intl
    ? new (Intl as unknown as { Segmenter: new (l?: string, o?: { granularity: string }) => { segment(input: string): Iterable<unknown> } }).Segmenter("da", { granularity: "grapheme" })
    : null;

/** Antal grafemer (Bluesky, X tæller ca. det samme for vestlige tegn). */
export function graphemeLength(text: string): number {
  if (!text) return 0;
  if (segmenter) {
    let n = 0;
    for (const _ of segmenter.segment(text)) { void _; n += 1; }
    return n;
  }
  return Array.from(text).length;
}

/** Selve opslaget som det sendes: tekst + hashtags (+ link hvor platformen viser links i teksten). */
export function composePost(platform: SocialPlatform, post: SocialPost, link?: string): string {
  const spec = PLATFORM_SPECS[platform];
  const parts: string[] = [post.tekst.trim()];
  const tags = normalizeHashtags(post.hashtags).map((t) => `#${t}`);
  if (tags.length) parts.push(tags.join(" "));
  const finalLink = link ?? post.link;
  if (finalLink && spec.linkInline) parts.push(finalLink);
  return parts.filter(Boolean).join("\n\n");
}

/** Effektiv længde efter platformens regler (X: link = 23 tegn uanset længde). */
export function postLength(platform: SocialPlatform, post: SocialPost): number {
  const spec = PLATFORM_SPECS[platform];
  const tags = normalizeHashtags(post.hashtags).map((t) => `#${t}`);
  let n = graphemeLength(post.tekst.trim());
  if (tags.length) n += (n ? 2 : 0) + graphemeLength(tags.join(" "));
  if (post.link && spec.linkInline) n += (n ? 2 : 0) + (spec.linkLength ?? graphemeLength(post.link));
  return n;
}

export type PostCheck = { length: number; max: number; recommended: number; errors: string[]; warnings: string[] };

export function checkPost(platform: SocialPlatform, post: SocialPost | undefined): PostCheck {
  const spec = PLATFORM_SPECS[platform];
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!post) return { length: 0, max: spec.max, recommended: spec.recommended, errors, warnings };
  const length = postLength(platform, post);
  const tags = normalizeHashtags(post.hashtags);
  if (length > spec.max) errors.push(`${spec.label}: opslaget er ${length} tegn, grænsen er ${spec.max}.`);
  else if (length > spec.recommended) warnings.push(`${spec.label}: ${length} tegn — anbefalet højst ${spec.recommended}.`);
  if (tags.length > spec.maxHashtags) errors.push(`${spec.label}: højst ${spec.maxHashtags} hashtags.`);
  else if (tags.length > spec.recommendedHashtags) warnings.push(`${spec.label}: anbefalet højst ${spec.recommendedHashtags} hashtags.`);
  return { length, max: spec.max, recommended: spec.recommended, errors, warnings };
}

export function defaultUtm(platform: SocialPlatform, slug: string): SocialUtm {
  return { source: platform === "x" ? "x" : platform, medium: "social", campaign: slug.slice(0, 80) };
}

/** Tilføjer UTM-parametre til en artikel-URL (bevarer eksisterende query). */
export function buildShareLink(url: string, utm: SocialUtm | undefined): string {
  if (!utm || !url) return url;
  try {
    const u = new URL(url);
    if (utm.source) u.searchParams.set("utm_source", utm.source);
    if (utm.medium) u.searchParams.set("utm_medium", utm.medium);
    if (utm.campaign) u.searchParams.set("utm_campaign", utm.campaign);
    return u.toString();
  } catch {
    return url;
  }
}

// ── Øvrige konstanter ───────────────────────────────────────────────────────

export const TWITTER_CARDS = ["summary", "summary_large_image"] as const;
export const SCHEMA_TYPES = [
  "NewsArticle",
  "OpinionNewsArticle",
  "AnalysisNewsArticle",
  "ReportageNewsArticle",
  "BackgroundNewsArticle",
  "ReviewNewsArticle",
  "Report",
  "Article",
  "BlogPosting",
] as const;
export type SchemaType = (typeof SCHEMA_TYPES)[number];
/** Typer der må bære `dateline` (schema.org: NewsArticle og undertyper). */
export const NEWS_SCHEMA_TYPES: readonly string[] = ["NewsArticle", "OpinionNewsArticle", "AnalysisNewsArticle", "ReportageNewsArticle", "BackgroundNewsArticle", "ReviewNewsArticle"];

export const CREDIT_ROLES = ["Medforfatter", "Fotograf", "Redaktør", "Grafiker", "Researcher", "Oversætter"] as const;

export const META_LIMITS = {
  ogTitel: 95,
  ogBeskrivelse: 200,
  twitterTitel: 70,
  twitterBeskrivelse: 200,
  seoTitel: 70,
  seoBeskrivelse: 200,
  dateline: 80,
  keywords: 20,
  newsKeywords: 10,
  keyword: 60,
  medforfattere: 12,
  kilder: 30,
  /** Uddrag af en kildes egen tekst (internt, til faktatjek). */
  uddrag: 4000,
} as const;

// ── Zod-skema ───────────────────────────────────────────────────────────────

const optText = (max: number) =>
  z.preprocess((v) => (typeof v === "string" ? v.trim() : v), z.string().max(max, `Højst ${max} tegn.`).nullish().transform((v) => (v ? v : null)));

const httpUrl = (label = "URL") =>
  z.preprocess(
    (v) => (typeof v === "string" ? v.trim() : v),
    z
      .string()
      .max(2000)
      .nullish()
      .refine((v) => !v || /^https?:\/\//i.test(v) && URL.canParse(v), `${label} skal være en gyldig http(s)-adresse.`)
      .transform((v) => (v ? v : null)),
  );

const dateInput = z.preprocess(
  (v) => (v === "" || v === undefined ? null : v),
  z
    .union([z.null(), z.date(), z.string()])
    .refine((v) => v === null || !Number.isNaN(new Date(v as string | Date).getTime()), "Ugyldigt tidspunkt.")
    .transform((v) => (v === null ? null : new Date(v as string | Date))),
);

const idText = z.preprocess((v) => (typeof v === "string" ? v.trim() : v), z.string().max(60).nullish().transform((v) => (v ? v : null)));

const keywordList = (max: number) =>
  z
    .array(z.string())
    .max(max, `Højst ${max} nøgleord.`)
    .default([])
    .transform((list) => {
      const out: string[] = [];
      for (const raw of list) {
        const k = raw.replace(/\s+/g, " ").trim().slice(0, META_LIMITS.keyword);
        if (k && !out.some((x) => x.toLowerCase() === k.toLowerCase())) out.push(k);
      }
      return out;
    });

const utmSchema = z.object({
  source: z.string().trim().max(60).default(""),
  medium: z.string().trim().max(60).default(""),
  campaign: z.string().trim().max(100).default(""),
});

const postSchema = z.object({
  tekst: z.string().max(6000).default(""),
  hashtags: z.array(z.string()).max(40).default([]).transform(normalizeHashtags),
  link: httpUrl("Linket").optional(),
  utm: utmSchema.optional(),
});

const socialSchema = z
  .object({
    facebook: postSchema.optional(),
    instagram: postSchema.optional(),
    linkedin: postSchema.optional(),
    x: postSchema.optional(),
    bluesky: postSchema.optional(),
  })
  .default({})
  .superRefine((social, ctx) => {
    for (const platform of SOCIAL_PLATFORMS) {
      const post = social[platform];
      if (!post) continue;
      for (const message of checkPost(platform, { tekst: post.tekst, hashtags: post.hashtags, link: post.link ?? undefined }).errors) {
        ctx.addIssue({ code: "custom", message, path: [platform] });
      }
    }
  });

const creditSchema = z.object({
  authorId: idText.optional(),
  navn: z.string().trim().min(1, "Angiv navn.").max(120),
  rolle: z.string().trim().min(1).max(40).default("Medforfatter"),
});

const sourceSchema = z.object({
  titel: z.string().trim().min(1, "Angiv kildens titel.").max(200),
  url: httpUrl("Kilde-URL").optional(),
  udgiver: optText(120).optional(),
  dato: optText(40).optional(),
  // Interne felter til Production Engine. De udgives ALDRIG: schema.org-citationen (lib/seo/jsonld.ts) bruger kun titel/url/udgiver/dato.
  /** Uddrag af kildens egen tekst. Bruges til at kontrollere tal og citater i artiklen mod originalen. */
  uddrag: optText(META_LIMITS.uddrag).optional(),
  /** Kildetype (SOURCE_TYPES/"nyhedsbureau"/"borger"/"meddeler"); ratingen slår den op i kilderegisteret. */
  type: optText(40).optional(),
  /** Redaktørens egen karakter, der går forud for registeret og standarden. */
  rating: z.enum(["A", "B", "C", "D"]).nullish().transform((v) => v ?? null).optional(),
});

const paywallSchema = z
  .object({ cssSelector: z.string().trim().max(120).regex(/^[A-Za-z0-9_.#\-\s>[\]="':*,]+$/, "Ugyldig CSS-selector.") })
  .nullish()
  .transform((v) => (v && v.cssSelector ? v : null));

const translationsSchema = z
  .record(z.string().regex(/^[a-z]{2}(-[A-Za-z]{2})?$/, "Ugyldigt sprogkode."), z.object({ url: httpUrl("Oversættelsens URL"), titel: optText(200).optional() }))
  .nullish()
  .transform((v) => {
    if (!v) return null;
    const out: Record<string, { url: string; titel: string | null }> = {};
    for (const [lang, t] of Object.entries(v)) if (t.url) out[lang] = { url: t.url, titel: t.titel ?? null };
    return Object.keys(out).length ? out : null;
  });

export const articleMetaSchema = z.object({
  canonicalUrl: httpUrl("Canonical").default(null),
  robotsNoindex: z.boolean().default(false),
  robotsNofollow: z.boolean().default(false),
  keywords: keywordList(META_LIMITS.keywords),
  newsKeywords: keywordList(META_LIMITS.newsKeywords),
  ogTitel: optText(META_LIMITS.ogTitel).default(null),
  ogBeskrivelse: optText(META_LIMITS.ogBeskrivelse).default(null),
  ogMediaId: idText.default(null),
  twitterCard: z.enum(TWITTER_CARDS).nullish().transform((v) => v ?? null),
  twitterTitel: optText(META_LIMITS.twitterTitel).default(null),
  twitterBeskrivelse: optText(META_LIMITS.twitterBeskrivelse).default(null),
  twitterMediaId: idText.default(null),
  social: socialSchema,
  schemaType: z.enum(SCHEMA_TYPES).nullish().transform((v) => v ?? null),
  isAccessibleForFree: z.boolean().default(true),
  paywall: paywallSchema.default(null),
  dateline: optText(META_LIMITS.dateline).default(null),
  standout: z.boolean().default(false),
  laesetidMin: z.preprocess((v) => (v === "" || v === undefined ? null : v), z.coerce.number().int().min(1, "Mindst 1 minut.").max(240, "Højst 240 minutter.").nullable()).default(null),
  udloebTid: dateInput.default(null),
  begivenhedTid: dateInput.default(null),
  medforfattere: z.array(creditSchema).max(META_LIMITS.medforfattere).default([]),
  kilder: z.array(sourceSchema).max(META_LIMITS.kilder).default([]),
  sistSubstantielOpdateringTid: dateInput.default(null),
  oversaettelser: translationsSchema.default(null),
});

export type ArticleMetaValue = z.output<typeof articleMetaSchema>;
export type ArticleMetaInput = z.input<typeof articleMetaSchema>;
export type MetaCredit = ArticleMetaValue["medforfattere"][number];
export type MetaSource = ArticleMetaValue["kilder"][number];

/** Tom (standard)metadata. */
export function emptyMeta(): ArticleMetaValue {
  return articleMetaSchema.parse({});
}

/** true hvis metadataene er identiske med standarden (så der ikke oprettes en tom ArticleMeta-række). */
export function isDefaultMeta(meta: ArticleMetaValue): boolean {
  return JSON.stringify(serializeMeta(meta)) === JSON.stringify(serializeMeta(emptyMeta()));
}

type Row = Record<string, unknown> | null | undefined;

/** Databaserække -> værdi (tolerant over for gamle/ugyldige Json-værdier: ugyldigt felt falder tilbage til standard). */
export function metaFromRow(row: Row): ArticleMetaValue {
  if (!row) return emptyMeta();
  const strict = articleMetaSchema.safeParse(row);
  if (strict.success) return strict.data;
  // Fald tilbage felt for felt, så ét ødelagt Json-felt ikke skjuler resten.
  const base = emptyMeta();
  const shape = articleMetaSchema.shape;
  const out: Record<string, unknown> = { ...base };
  for (const key of Object.keys(shape) as Array<keyof typeof shape>) {
    const parsed = shape[key].safeParse(row[key]);
    if (parsed.success) out[key] = parsed.data;
  }
  return out as ArticleMetaValue;
}

/** Værdi -> JSON-sikker form til klienten (datoer som ISO-strenge). */
export function serializeMeta(meta: ArticleMetaValue) {
  return {
    ...meta,
    udloebTid: meta.udloebTid ? meta.udloebTid.toISOString() : null,
    begivenhedTid: meta.begivenhedTid ? meta.begivenhedTid.toISOString() : null,
    sistSubstantielOpdateringTid: meta.sistSubstantielOpdateringTid ? meta.sistSubstantielOpdateringTid.toISOString() : null,
  };
}
export type ArticleMetaForm = ReturnType<typeof serializeMeta>;

/** Parser rå JSON fra formularfeltet `meta`. Tom/manglende værdi betyder "uændret" (undefined). */
export function parseMetaField(raw: FormDataEntryValue | null): { ok: true; value: ArticleMetaValue | undefined } | { ok: false; error: string } {
  if (typeof raw !== "string" || raw.trim() === "") return { ok: true, value: undefined };
  let json: unknown;
  try { json = JSON.parse(raw); } catch { return { ok: false, error: "Metadata kunne ikke læses." }; }
  const parsed = articleMetaSchema.safeParse(json);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const where = issue?.path.length ? ` (${issue.path.join(" › ")})` : "";
    return { ok: false, error: `${issue?.message ?? "Ugyldig metadata."}${where}` };
  }
  return { ok: true, value: parsed.data };
}

/** Prisma-data til upsert (Json-felter som rene værdier). */
export function metaToDb(meta: ArticleMetaValue) {
  return {
    canonicalUrl: meta.canonicalUrl,
    robotsNoindex: meta.robotsNoindex,
    robotsNofollow: meta.robotsNofollow,
    keywords: meta.keywords,
    newsKeywords: meta.newsKeywords,
    ogTitel: meta.ogTitel,
    ogBeskrivelse: meta.ogBeskrivelse,
    ogMediaId: meta.ogMediaId,
    twitterCard: meta.twitterCard,
    twitterTitel: meta.twitterTitel,
    twitterBeskrivelse: meta.twitterBeskrivelse,
    twitterMediaId: meta.twitterMediaId,
    social: meta.social as Record<string, unknown>,
    schemaType: meta.schemaType,
    isAccessibleForFree: meta.isAccessibleForFree,
    paywall: meta.paywall,
    dateline: meta.dateline,
    standout: meta.standout,
    laesetidMin: meta.laesetidMin,
    udloebTid: meta.udloebTid,
    begivenhedTid: meta.begivenhedTid,
    medforfattere: meta.medforfattere,
    kilder: meta.kilder,
    sistSubstantielOpdateringTid: meta.sistSubstantielOpdateringTid,
    oversaettelser: meta.oversaettelser,
  };
}

/** Fletter et delvist metadata-patch ind i eksisterende metadata (opslagstekster flettes pr. platform) og validerer helheden. */
export function mergeMeta(current: ArticleMetaValue, patch: Partial<ArticleMetaInput>): { ok: true; value: ArticleMetaValue } | { ok: false; error: string } {
  const merged = { ...serializeMeta(current), ...patch, social: { ...current.social, ...(patch.social ?? {}) } };
  const parsed = articleMetaSchema.safeParse(merged);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, error: `${issue?.message ?? "Ugyldig metadata."}${issue?.path.length ? ` (${issue.path.join(" › ")})` : ""}` };
  }
  return { ok: true, value: parsed.data };
}

// ── Sprog ───────────────────────────────────────────────────────────────────

const LOCALES: Record<string, string> = { da: "da_DK", en: "en_GB", de: "de_DE", sv: "sv_SE", no: "nb_NO", nb: "nb_NO", nn: "nn_NO", fi: "fi_FI", fr: "fr_FR", es: "es_ES", pl: "pl_PL", uk: "uk_UA" };

/** `sprog` ("da", "en", "en-US") -> Open Graph-locale ("da_DK", "en_GB", "en_US"). */
export function ogLocale(sprog: string | null | undefined): string {
  const raw = (sprog ?? "da").trim().replace("-", "_");
  if (!raw) return "da_DK";
  const [lang, region] = raw.split("_");
  if (region && /^[A-Za-z]{2}$/.test(region)) return `${lang.toLowerCase()}_${region.toUpperCase()}`;
  return LOCALES[lang.toLowerCase()] ?? lang.toLowerCase();
}

/** `sprog` -> BCP-47 til JSON-LD `inLanguage`. */
export function inLanguage(sprog: string | null | undefined): string {
  const raw = (sprog ?? "da").trim();
  if (!raw || raw === "da") return "da-DK";
  return raw.replace("_", "-");
}
