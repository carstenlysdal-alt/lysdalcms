import type { ArticleMetaForm } from "@/lib/article-meta";
import type { AiBundle } from "@/components/editor/editor-sections";
import type { useEditorialAi } from "@/components/editor/use-editorial-ai";
import type { SeoScore } from "@/lib/editor/seo-score";
import type { EditorFlags, EditorOptions, EditorSite } from "@/lib/editor/types";
import type { ClaimCheck } from "@/lib/engine/claims";
import type { HeadlineCheck, Readability } from "@/lib/engine/quality";
import type { BasisCheck, SourceProfileLite, SourceRating } from "@/lib/engine/source-rating";

export type EngineSource = ArticleMetaForm["kilder"][number];

export type TabId = "skriv" | "kvalitet" | "fakta" | "kilder" | "soeg";

/** Alt copiloten får fra editoren (som ejer artiklens tilstand). Intet her gemmer noget af sig selv. */
export type CopilotCtx = {
  articleId: string | null;
  titel: string;
  manchet: string;
  bodyText: string;
  wordCount: number;
  restricted: boolean;
  flags: EditorFlags;
  kilder: EngineSource[];
  setKilder: (kilder: EngineSource[]) => void;
  score: SeoScore;
  profiles: SourceProfileLite[];
  aiProvider: string | null;
  ai: AiBundle;
  raw: ReturnType<typeof useEditorialAi>;
  site: EditorSite;
  options: EditorOptions;
};

/** Beregnet ét sted og delt mellem fanerne, så de altid viser det samme. */
export type Derived = {
  claims: ClaimCheck[];
  claimCounts: { stoettet: number; mangler: number; ukontrolleret: number; total: number };
  read: Readability;
  headline: HeadlineCheck[];
  ratings: SourceRating[];
  basis: BasisCheck[];
  excerptCount: number;
};
