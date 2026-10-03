import "server-only";
import { z } from "zod";

const schema = z.object({
  cmsInstanceId: z.string().min(1).max(128), articleId: z.string().min(1).max(128),
  views: z.number().int().nonnegative().safe(), reads: z.number().int().nonnegative().safe(),
  readerSeconds: z.number().int().nonnegative().safe(), asOf: z.date(),
}).strict();

/** CMS ArticleMetric counters are cumulative article totals, not per-revision/user/time-window facts.
 * Repeated observations must replace/reconcile counters, NEVER sum snapshots as new events.
 */
export function projectArticleMetrics(input: z.input<typeof schema>) {
  const m = schema.parse(input);
  return {
    contractVersion: "cms-article-metrics.v0" as const,
    analyticsIdentity: { system: "bylokalt-cms", cmsInstanceId: m.cmsInstanceId, articleId: m.articleId },
    grain: "cumulative-article" as const,
    asOf: m.asOf.toISOString(), articleVersionId: null,
    totals: { views: m.views, engagedReads: m.reads, readerSeconds: m.readerSeconds },
    semantics: { uniqueUsersAvailable: false, periodStartAvailable: false, revisionAttributionAvailable: false },
  };
}
