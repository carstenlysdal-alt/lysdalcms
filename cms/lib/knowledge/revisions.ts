import "server-only";
import type { AuthorizedUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { canEditArticle } from "@/lib/permissions";
import type { KnowledgeMapping } from "./config";
import { projectArticleMetrics } from "./metrics-projection";
import { projectPublishedRevision } from "./content-projection";

/** Local preparation only; no network writes/outbox simulation. No new CMS Article model. */
export async function prepareRevisionForMemory(user: AuthorizedUser, articleId: string, revisionId: string, mapping: KnowledgeMapping) {
  if (mapping.cmsInstanceId !== user.instansId) throw new Error("Knowledge mapping is not authorised for this CMS instance");
  const revision = await db.articleRevision.findFirst({ where: { id: revisionId, articleId, article: { instansId: user.instansId } },
    select: { id: true, articleId: true, snapshot: true, createdAt: true, article: { select: { forfatterId: true } } } });
  if (!revision || !canEditArticle(user, revision.article)) throw new Error("Article revision is not available");
  return projectPublishedRevision({ articleId: revision.articleId, revisionId: revision.id, snapshot: revision.snapshot, recordedAt: revision.createdAt }, mapping);
}

/** Existing aggregate metrics stay CMS-owned; no raw visitor IDs or inferred version attribution. */
export async function prepareMetricsForMemory(user: AuthorizedUser, articleId: string) {
  const article = await db.article.findFirst({ where: { id: articleId, instansId: user.instansId }, select: { forfatterId: true } });
  if (!article || !canEditArticle(user, article)) throw new Error("Article metrics are not available");
  const metric = await db.articleMetric.findFirst({ where: { articleId, instansId: user.instansId },
    select: { visninger: true, laesninger: true, totalLaesetidSek: true, opdateretTid: true } });
  if (!metric) return null;
  return projectArticleMetrics({ cmsInstanceId: user.instansId, articleId, views: metric.visninger,
    reads: metric.laesninger, readerSeconds: metric.totalLaesetidSek, asOf: metric.opdateretTid });
}
