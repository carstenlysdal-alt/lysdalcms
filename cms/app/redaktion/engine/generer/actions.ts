"use server";

import { getAuthorizedUser } from "@/lib/auth";
import { fetchUrlSource, readPdfSource, textSource, type SourceDraftResult } from "@/lib/generate/ingest";
import { createDraftFromRun, runGeneration, type DraftResult, type GenerateResponse } from "@/lib/generate/service";
import { LIMITS } from "@/lib/generate/types";
import { PERMISSIONS } from "@/lib/permissions";

/** Handlinger i artikelgeneratoren. Rettigheder og spærringer afgøres i lib/generate/*; her slås kun brugeren op i databasen. */
const denied = { ok: false as const, error: "Du har ikke adgang til artikelgeneratoren." };
const user = () => getAuthorizedUser(PERMISSIONS.ARTICLE_CREATE);

export async function fetchUrlSourceAction(url: string): Promise<SourceDraftResult> {
  const u = await user();
  return u ? fetchUrlSource(u, String(url ?? "")) : denied;
}

export async function readPdfSourceAction(formData: FormData): Promise<SourceDraftResult> {
  const u = await user();
  if (!u) return denied;
  const file = formData.get("fil");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Vælg en PDF-fil." };
  if (file.size > LIMITS.pdfBytes) return { ok: false, error: "PDF'en er større end 10 MB." };
  return readPdfSource(u, { name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) });
}

export async function addTextSourceAction(input: { titel: string; udgiver?: string | null; dato?: string | null; tekst: string }): Promise<SourceDraftResult> {
  const u = await user();
  return u ? textSource({ titel: String(input?.titel ?? ""), udgiver: input?.udgiver ?? null, dato: input?.dato ?? null, tekst: String(input?.tekst ?? "") }) : denied;
}

export async function generateAction(payload: unknown): Promise<GenerateResponse> {
  const u = await user();
  return u ? runGeneration(u, payload) : { ok: false, code: "forbudt", error: denied.error };
}

export async function createDraftAction(runId: string, kategoriId: string | null): Promise<DraftResult> {
  const u = await user();
  return u ? createDraftFromRun(u, String(runId), { kategoriId: kategoriId || null }) : denied;
}
