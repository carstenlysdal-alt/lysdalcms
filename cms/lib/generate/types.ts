/**
 * Artikelgeneratoren (Production Engine): fra feeds og originalkilder til en komplet kladde med metadata.
 * Typer og profiler er RENE data uden afhængigheder, så de kan bruges af både server og klient.
 */

export const SOURCE_KINDS = ["signal", "url", "pdf", "tekst", "billede"] as const;
export type SourceKind = (typeof SOURCE_KINDS)[number];
export const SOURCE_KIND_LABEL: Record<SourceKind, string> = { signal: "Feed", url: "Webadresse", pdf: "PDF", tekst: "Tekst", billede: "Billede" };

/** Hvad redaktionen må gøre med materialet. Billeder hentes aldrig; rettigheder er altid uafklarede, til en redaktør har afklaret dem. */
export type ImageRef = { url: string; alt: string | null; billedtekst: string | null };

/** Én kilde i grundlaget. `id` (K1, K2 …) er det, modellen henviser til. */
export type GenSource = {
  id: string;
  kind: SourceKind;
  titel: string;
  udgiver: string | null;
  url: string | null;
  /** ISO-dato (YYYY-MM-DD) hvis kendt. */
  dato: string | null;
  /** Kildetype (SOURCE_TYPES), bruges til rating og til spærring af politi/112. */
  type: string | null;
  /** Kildens egen tekst: det, modellen skriver ud fra, og det, faktatjekket sammenholder med. */
  tekst: string;
  rating: { grade: string; score: number } | null;
  billeder: ImageRef[];
  /** Signalets id i databasen, hvis kilden er et feedkort. */
  signalId?: string | null;
};

/** Et råt materiale, før det får K-id. Kommer fra feedkort, hentet webside, PDF, indsat tekst eller en billedhentning. */
export type RawSource = Omit<GenSource, "id" | "rating"> & { rating?: GenSource["rating"] };

export const PROFILE_IDS = ["nyhed", "citation", "citationLang", "syntese"] as const;
export type ProfileId = (typeof PROFILE_IDS)[number];

export type ProfileRules = {
  titel: string;
  beskrivelse: string;
  /** Vejledende ordområde; uden for området advares, der afvises ikke. */
  ord: { min: number; max: number | null };
  minKilder: number;
  /** Højst antal ord i manchetten (advarsel). */
  manchetOrd: number;
  /** Kræver profilen mindst ét ordret citat? */
  kraeverCitat: boolean;
  schemaType: "NewsArticle" | "BackgroundNewsArticle" | "Article";
};

export const PROFILES: Record<ProfileId, ProfileRules> = {
  nyhed: { titel: "Nyhedsartikel", beskrivelse: "Nyhedstrekant på 250-450 ord ud fra ét eller flere signaler og kilder.", ord: { min: 200, max: 500 }, minKilder: 1, manchetOrd: 35, kraeverCitat: false, schemaType: "NewsArticle" },
  citation: { titel: "Citathistorie (kort)", beskrivelse: "Local Citation: 180-260 ord bygget om ét medies indhold, med kildens navn ordret og kun ordrette citater.", ord: { min: 150, max: 300 }, minKilder: 1, manchetOrd: 25, kraeverCitat: false, schemaType: "NewsArticle" },
  citationLang: { titel: "Citathistorie (lang)", beskrivelse: "Længden bestemmes af stoffet: kildens indhold foldes ud, ikke komprimeres, uden opfundet fortolkning.", ord: { min: 300, max: null }, minKilder: 1, manchetOrd: 30, kraeverCitat: false, schemaType: "NewsArticle" },
  syntese: { titel: "Syntese", beskrivelse: "Local Syntese: en sammenhængende baggrundsartikel på 400-600 ord ud fra mindst to kilder.", ord: { min: 350, max: 700 }, minKilder: 2, manchetOrd: 35, kraeverCitat: false, schemaType: "BackgroundNewsArticle" },
};

export const isProfileId = (v: unknown): v is ProfileId => typeof v === "string" && (PROFILE_IDS as readonly string[]).includes(v);

export const LIMITS = {
  maxSources: 8,
  /** Tegn pr. kilde, der sendes til modellen. */
  perSourceChars: 12_000,
  /** Samlet tegn til modellen. */
  totalChars: 48_000,
  /** Mindste tekstlængde, en kilde skal have for at give grundlag. */
  minSourceChars: 50,
  briefChars: 1_000,
  pdfBytes: 10 * 1024 * 1024,
  maxPdfPages: 60,
} as const;

// ── Resultat ─────────────────────────────────────────────────────────────────

export type GenBlock =
  | { type: "afsnit"; tekst: string; kilder: string[] }
  | { type: "mellemrubrik"; tekst: string }
  | { type: "citat"; tekst: string; taler: string | null; kilder: string[] }
  | { type: "faktaboks"; titel: string; tekst: string; kilder: string[] };

export type GenSocial = { tekst: string; hashtags: string[] };

export type GenWarning = { kode: string; niveau: "advarsel" | "fjernet"; tekst: string };

export type GeneratedArticle = {
  titel: string;
  manchet: string;
  blokke: GenBlock[];
  seoTitel: string;
  seoBeskrivelse: string;
  slug: string;
  tldr: string;
  tags: string[];
  omraader: string[];
  opslag: { facebook?: GenSocial; x?: GenSocial };
  billeder: Array<{ kilde: string; alt: string; billedtekst: string }>;
  brugteKilder: string[];
  /** Hvad modellen savnede grundlag for. Vises som opgaver til redaktøren. */
  mangler: string[];
};

export type GenStats = { ord: number; afsnit: number; citater: number; stoettet: number; mangler: number; ukontrolleret: number };

export type GenerationResult = {
  profil: ProfileId;
  artikel: GeneratedArticle;
  advarsler: GenWarning[];
  statistik: GenStats;
  promptVersion: string;
  modelId: string | null;
};
