import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import { blocksSchema } from "@/lib/blocks/schema";
import { blocksPlainText } from "@/lib/blocks/text";
import type { KnowledgeMapping } from "./config";

const id = z.string().min(1).max(128);
const snapshotSchema = z.object({ id, instansId: id, status: z.literal("Publiceret"),
  titel: z.string().min(1).max(1000), manchet: z.string().nullable().optional(),
  blocks: blocksSchema, sprog: z.string().min(2).max(20), publiceretTid: z.string().datetime({ offset: true }),
});
const mappingSchema = z.object({ cmsInstanceId: id, tenantId: z.string().uuid(), instanceId: z.string().uuid() });

/** Internal proposed projection, not a live Knowledge OS event/API contract.
 * Input is an immutable CMS ArticleRevision snapshot, NEVER the current Article row.
 * Whitelists published text; excludes user IDs, private provenance and visitor data.
 */
export function projectPublishedRevision(input: { articleId: string; revisionId: string; snapshot: unknown; recordedAt: Date }, mapping: KnowledgeMapping) {
  const target = mappingSchema.parse(mapping);
  const articleId = id.parse(input.articleId), revisionId = id.parse(input.revisionId);
  const snapshot = snapshotSchema.parse(input.snapshot);
  if (snapshot.id !== articleId || snapshot.instansId !== target.cmsInstanceId) throw new Error("Article revision does not match its authorised identity");
  if (Number.isNaN(input.recordedAt.getTime())) throw new Error("Invalid revision timestamp");
  const contentText = blocksPlainText(snapshot.blocks);
  if (!contentText.trim() || contentText.length > 1_000_000) throw new Error("Published revision has no valid textual content");
  const body = {
    contractVersion: "cms-memory-projection.v0" as const,
    target: { tenantId: target.tenantId, instanceId: target.instanceId },
    externalObject: { system: "bylokalt-cms" as const, type: "Article" as const,
      cmsInstanceId: target.cmsInstanceId, articleId, articleVersionId: revisionId },
    content: { title: snapshot.titel, summary: snapshot.manchet ?? null, language: snapshot.sprog, contentText,
      publishedAt: new Date(snapshot.publiceretTid).toISOString(), recordedAt: input.recordedAt.toISOString(),
      extractionVersion: "cms-block-text-v1", textHash: createHash("sha256").update(contentText,"utf8").digest("hex") },
    // No invented graph entities, topics or source attribution. Receiver enrichment is proposed/reviewed.
    analyticsIdentity: { system: "bylokalt-cms", cmsInstanceId: target.cmsInstanceId, articleId },
  };
  return { ...body, projectionHash: createHash("sha256").update(JSON.stringify(body),"utf8").digest("hex") };
}
