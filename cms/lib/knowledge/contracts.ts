import { z } from "zod";
import type { CmsResearch } from "./legacy-adapter";

/** CMS-owned interface, independent of Knowledge OS database columns. */
export type ResearchResult = CmsResearch;
export const researchRequestSchema = z.object({
  query: z.string().trim().min(2).max(300),
  articleId: z.string().min(1).max(128).optional(),
}).strict();
export type ResearchRequest = z.infer<typeof researchRequestSchema>;
export type ResearchResponse =
  | { ok: true; result: ResearchResult }
  | { ok: false; code: "forbudt" | "ugyldig" | "rate"; error: string };
