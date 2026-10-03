/**
 * Planlagt publicering: flytter KUN artikler i status "Planlagt" med planlagtTid <= nu til "Publiceret".
 *
 *  - Idempotent: selve statusskiftet er en betinget opdatering (`updateMany` med status "Planlagt"), så to samtidige kørsler
 *    publicerer aldrig den samme artikel to gange, og en allerede publiceret artikel røres ikke.
 *  - Håndhæver de samme publiceringskrav som editoren (mærkning, AI-brug registreret, kilde verificeret). En artikel der
 *    ikke opfylder dem springes over (bliver stående som Planlagt og rapporteres) — scheduleren publicerer aldrig
 *    noget, en redaktør ikke kunne have publiceret.
 *  - Små batches (standard 20), ældste forfaldne først, valgfrit afgrænset til én instans.
 *  - Skriver revision (actor "scheduler", ingen bruger-id), AuditLog og rydder CDN-cache (purgeInstance -> purgeUrls).
 */
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { assertPublishableMarking, normalizeAiUse } from "@/lib/marking";
import { purgeInstance } from "@/lib/cache/purge";
import { completeAssignmentOnPublish } from "@/lib/article-save";
import { publicPath } from "@/lib/slug-redirect";
import { queuePublishedRevision } from "@/lib/knowledge/publication-outbox";

export const SCHEDULER_ACTOR = "scheduler";
export const DEFAULT_BATCH = 20;
export const MAX_BATCH = 100;

export type ScheduledResult = {
  checked: number;
  published: Array<{ id: string; instansId: string; slug: string }>;
  skipped: Array<{ id: string; instansId: string; reason: string }>;
};

export function publishBlocker(article: { indholdstype: string; marking: unknown; aiBrug: unknown }): string | null {
  const aiBrug = Array.isArray(article.aiBrug) ? article.aiBrug.filter((v): v is string => typeof v === "string") : [];
  const ai = normalizeAiUse(aiBrug, { requireChoice: true });
  if (!ai.ok) return ai.error;
  const marking = article.marking && typeof article.marking === "object" && !Array.isArray(article.marking) ? (article.marking as Record<string, unknown>) : null;
  if (marking?.uverificeretKilde === true) return "Kildens identitet er ikke verificeret.";
  try {
    assertPublishableMarking(article.indholdstype, marking);
  } catch (error) {
    return error instanceof Error ? error.message : "Mærkningen er ugyldig.";
  }
  return null;
}

export async function publishDueArticles(opts: { now?: Date; batchSize?: number; instansId?: string } = {}): Promise<ScheduledResult> {
  const now = opts.now ?? new Date();
  const take = Math.min(Math.max(1, Math.floor(opts.batchSize ?? DEFAULT_BATCH)), MAX_BATCH);
  const due = await db.article.findMany({
    where: { status: "Planlagt", planlagtTid: { not: null, lte: now }, ...(opts.instansId ? { instansId: opts.instansId } : {}) },
    orderBy: { planlagtTid: "asc" },
    take,
    include: { kategori: { include: { parent: true } } },
  });

  const result: ScheduledResult = { checked: due.length, published: [], skipped: [] };
  for (const article of due) {
    const blocker = publishBlocker(article);
    if (blocker) {
      result.skipped.push({ id: article.id, instansId: article.instansId, reason: blocker });
      continue;
    }
    const outcome = await db.$transaction(async (tx) => {
      // Betinget: kun hvis artiklen stadig er Planlagt (en anden kørsel/redaktør kan have nået den først).
      const moved = await tx.article.updateMany({
        where: { id: article.id, instansId: article.instansId, status: "Planlagt", planlagtTid: { not: null, lte: now } },
        data: { status: "Publiceret", publiceretTid: article.publiceretTid ?? now },
      });
      if (moved.count !== 1) return false;
      const fresh = await tx.article.findUniqueOrThrow({ where: { id: article.id } });
      await completeAssignmentOnPublish(tx, fresh, article.instansId);
      const revision = await tx.articleRevision.create({
        data: {
          articleId: fresh.id,
          userId: null,
          snapshot: { ...JSON.parse(JSON.stringify(fresh)), _actor: SCHEDULER_ACTOR } as Prisma.InputJsonValue,
          note: `Publiceret (planlagt ${article.planlagtTid?.toISOString()}) af ${SCHEDULER_ACTOR}`,
        },
      });
      await queuePublishedRevision(tx, revision.id);
      await writeAudit(tx, { instansId: article.instansId, actorLabel: SCHEDULER_ACTOR, action: "article.publish.scheduled", targetId: article.id, targetLabel: article.slug });
      return true;
    });
    if (!outcome) continue;
    result.published.push({ id: article.id, instansId: article.instansId, slug: article.slug });
    try { revalidatePath("/"); revalidatePath("/redaktion/artikler"); } catch { /* uden for en Next-request (tests/scripts) */ }
    void purgeInstance(article.instansId, [publicPath(article.kategori, article.slug)]); // no-op uden CF_API_TOKEN
  }
  return result;
}
