/** Klient-sikre typer for artikel-editoren (serialiserede data; datoer som ISO-strenge). */
import type { Block } from "@/lib/blocks/schema";
import type { Marking } from "@/lib/marking";
import type { ArticleMetaForm } from "@/lib/article-meta";

export type Option = { id: string; navn: string };
export type CategoryOption = { id: string; navn: string; /** 1-6, til farveprik (token --cms-chart-N). */ tone: number; /** Sektionsslug i den offentlige URL. */ sektionSlug: string };
export type MediaOption = { id: string; url: string; altTekst: string | null; billedtekst: string | null; filnavn: string | null; ophavsperson?: string | null; bredde?: number | null; hoejde?: number | null };

export type ArticleEditorValue = {
  id: string | null;
  titel: string;
  manchet: string;
  slug: string;
  blocks: Block[];
  status: string;
  indholdstype: string;
  aiBrug: string[];
  marking: Marking | null;
  pinned: boolean;
  breaking: boolean;
  seoTitel: string;
  seoBeskrivelse: string;
  sprog: string;
  kategoriId: string;
  forfatterId: string;
  coverMediaId: string;
  tagIds: string[];
  geoTagIds: string[];
  /** ISO (UTC) eller "". */
  planlagtTid: string;
  /** ms (opdateretTid) — konfliktkontrol. 0 for ny. */
  version: number;
  meta: ArticleMetaForm;
  publiceretTid: string | null;
};

export type EditorFlags = {
  /** Research is read-only and uses article permissions, not AI generation permissions. */
  canResearch?: boolean;
  canPublish: boolean;
  canControlFrontpage: boolean;
  canUseAi: boolean;
  /** Valgt kategori (eller dens forælder) er Krimi/Sundhed: AI-tekstforslag er spærret. */
  restrictedCategoryIds: string[];
};

export type EditorSite = { domaene: string; navn: string; base: string };

export type EditorOptions = {
  categories: CategoryOption[];
  authors: Option[];
  tags: Option[];
  geoTags: Option[];
  media: MediaOption[];
};
