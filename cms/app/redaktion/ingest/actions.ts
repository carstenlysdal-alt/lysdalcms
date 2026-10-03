"use server";

import { revalidatePath } from "next/cache";
import { getAuthorizedUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { PERMISSIONS } from "@/lib/permissions";
import { createApiKey } from "@/lib/ingest/auth";
import { INGEST_SCOPES, type IngestScope } from "@/lib/ingest/schema";
import { cleanText } from "@/lib/validation/text";

/** Opret en API-nøgle til brugerens egen instans. Klartekst-nøglen returneres KUN her og kan aldrig hentes igen. */
export async function createIngestKeyAction(name: string, scopes: string[], expiresInDays?: number) {
  const user = await getAuthorizedUser(PERMISSIONS.INGEST_MANAGE);
  if (!user) return { success: false as const, error: "Ingen adgang." };
  const cleanName = cleanText(String(name ?? ""), 120);
  if (cleanName.length < 3) return { success: false as const, error: "Angiv et navn (mindst 3 tegn)." };
  const valid = (Array.isArray(scopes) ? scopes : []).filter((s): s is IngestScope => (INGEST_SCOPES as readonly string[]).includes(s));
  if (valid.length === 0) return { success: false as const, error: "Vælg mindst ét scope." };
  const days = Number(expiresInDays ?? 0);
  const created = await createApiKey({
    instansId: user.instansId,
    name: cleanName,
    scopes: valid,
    expiresAt: Number.isFinite(days) && days > 0 ? new Date(Date.now() + Math.min(days, 730) * 86_400_000) : null,
    createdById: user.id,
  });
  revalidatePath("/redaktion/ingest");
  revalidatePath("/redaktion/kontrolrum/ingest");
  revalidatePath("/redaktion/kontrolrum");
  return { success: true as const, id: created.id, prefix: created.prefix, key: created.key };
}

export async function revokeIngestKeyAction(keyId: string) {
  const user = await getAuthorizedUser(PERMISSIONS.INGEST_MANAGE);
  if (!user) return { success: false as const, error: "Ingen adgang." };
  const result = await db.apiKey.updateMany({ where: { id: String(keyId), instansId: user.instansId, revokedAt: null }, data: { revokedAt: new Date() } });
  revalidatePath("/redaktion/ingest");
  revalidatePath("/redaktion/kontrolrum/ingest");
  revalidatePath("/redaktion/kontrolrum");
  return result.count === 1 ? { success: true as const } : { success: false as const, error: "Nøglen findes ikke eller er allerede tilbagekaldt." };
}
