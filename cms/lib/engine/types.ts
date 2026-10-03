/** Delte, klient-sikre typer for Production Engine (ingen database, ingen server-kode). */
import type { SourceGrade } from "./source-rating";

export type EngineTab = "feeds" | "tips" | "arkiv";
export const ENGINE_TABS: readonly EngineTab[] = ["feeds", "tips", "arkiv"];

export type CardRating = { grade: SourceGrade; score: number; label: string; begrundelse: string; foelsom: boolean };

export type CardKind = "signal" | "borgertip" | "meddeler" | "arkiv";

import type { CardScore } from "../score/present";

export type FeedCard = {
  /** "signal:<id>" | "tip:<id>" | "sag:<id>" | "arkiv:<id>" */
  id: string;
  kind: CardKind;
  overskrift: string;
  uddrag: string;
  kilde: string;
  kildeUrl: string | null;
  sourceType: string | null;
  tidIso: string;
  /** Færdigformateret tid (dansk tid), beregnet på serveren: "kl. 14:22" i dag, ellers "3. okt. kl. 14:22". */
  tidLabel: string;
  omraade: string | null;
  hoej: boolean;
  breaking: boolean;
  notable: boolean;
  laest: boolean;
  /** Maskinindsamlet signal, som en redaktør har godkendt til forsiden. */
  godkendt: boolean;
  maskinindsamlet: boolean;
  rating: CardRating;
  /** Eksisterende artikel, der allerede er startet fra dette kort (signal/tip). */
  articleId: string | null;
  /** Arkiv: emneoverlap 0-100. */
  match?: number;
  /** Local Score (kun signaler, når de er vurderet). */
  score?: CardScore | null;
};

export type FeedData = {
  cards: FeedCard[];
  counts: { signaler: number; ulaeste: number; tips: number };
  omraader: Array<{ slug: string; navn: string }>;
  sync: { sidsteMaskinSignalIso: string | null; maskin24t: number };
};

/** En kilde klar til at blive lagt på en artikel (kilder i metadata). */
export type SourceDraft = { titel: string; url: string | null; udgiver: string | null; dato: string | null; uddrag: string | null; type: string | null };

export type MaterialKind = "artikel" | "signal" | "tip" | "sag" | "emne";
export type SearchHit = {
  /** "<kind>:<id>" */
  id: string;
  kind: MaterialKind;
  titel: string;
  uddrag: string;
  tidIso: string;
  /** Kort metalinje (status, kilde, område). */
  meta: string;
  /** Kan lægges på artiklen som kilde (signal og publiceret artikel). */
  kanBruges: boolean;
  /** Intern lænke til at åbne emnet. */
  href: string | null;
};
export type SearchResult = { ok: true; hits: SearchHit[]; query: string } | { ok: false; error: string };

export const SIGNAL_ARTICLE_PREFIX = "engine:signal:";
