import "server-only";
import type { Prisma } from "@prisma/client";

/** Called only inside the same transaction that creates a published ArticleRevision.
 * The row points to the immutable snapshot; delivery remains disabled until the receiver is ready.
 */
export async function queuePublishedRevision(tx: Prisma.TransactionClient, articleRevisionId: string) {
  return tx.knowledgePublicationOutbox.create({ data: { articleRevisionId } });
}
