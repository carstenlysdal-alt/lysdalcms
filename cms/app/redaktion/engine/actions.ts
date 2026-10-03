"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { guardAdminAction } from "@/lib/admin-guard";
import { scoreSignal, scoreSignals } from "@/lib/score/service";
import { getAuthorizedUser } from "@/lib/auth";
import { searchMaterial, sourceFromMaterial } from "@/lib/engine/material";
import { startArticleFromSignal } from "@/lib/engine/start";
import type { SearchResult, SourceDraft } from "@/lib/engine/types";
import { PERMISSIONS } from "@/lib/permissions";
import { convertMeddelerSagToArticle, convertSubmissionToArticle } from "../indbakke/actions";

/**
 * Handlinger fra Production Engine. Alle slår rettigheden op i databasen (getAuthorizedUser) og er afgrænset til brugerens aktive by.
 * "Start"-handlingerne omdirigerer til editoren, når historien er oprettet (eller fandtes i forvejen).
 */
export type ActionError = { ok: false; error: string };

const engineHref = (articleId: string) => `/redaktion/engine?id=${encodeURIComponent(articleId)}`;

export async function startFromSignalAction(signalId: string): Promise<ActionError> {
  const user = await getAuthorizedUser(PERMISSIONS.ARTICLE_CREATE);
  if (!user) return { ok: false, error: "Du har ikke rettigheder til at oprette artikler." };
  const res = await startArticleFromSignal(user, String(signalId));
  if (!res.ok) return res;
  redirect(engineHref(res.articleId));
}

/** Omsæt et borgertip eller en meddelersag til en kladde med den eksisterende indbakke-logik (mærkning og samtykke bevares). */
export async function startFromTipAction(kind: "tip" | "sag", id: string): Promise<ActionError> {
  const user = await getAuthorizedUser(PERMISSIONS.ARTICLE_CREATE);
  if (!user) return { ok: false, error: "Du har ikke rettigheder til at oprette artikler." };
  const res = kind === "tip" ? await convertSubmissionToArticle(String(id)) : kind === "sag" ? await convertMeddelerSagToArticle(String(id)) : null;
  if (!res || !res.success || !("articleId" in res) || !res.articleId) return { ok: false, error: (res && "error" in res && res.error) || "Historien kunne ikke oprettes." };
  redirect(engineHref(res.articleId));
}

export async function attachSourceAction(ref: string): Promise<{ ok: true; kilde: SourceDraft } | ActionError> {
  const user = await getAuthorizedUser(PERMISSIONS.ARTICLE_CREATE);
  if (!user) return { ok: false, error: "Ingen adgang." };
  return sourceFromMaterial(user, String(ref));
}

export async function searchMaterialAction(query: string): Promise<SearchResult> {
  const user = await getAuthorizedUser(PERMISSIONS.ARTICLE_CREATE);
  if (!user) return { ok: false, error: "Ingen adgang." };
  return searchMaterial(user, String(query));
}

/** Local Score for ét signal (AI estimerer, systemet beregner). Rate-limitet pr. bruger. */
export async function scoreSignalAction(signalId: string, force = false): Promise<{ ok: true; genbrugt: boolean } | ActionError> {
  const user = await getAuthorizedUser(PERMISSIONS.ARTICLE_AI_USE);
  if (!user) return { ok: false, error: "Du har ikke adgang til AI i artikelarbejdet." };
  const res = await scoreSignal(user, String(signalId), { force });
  if (!res.ok) return res;
  revalidatePath("/redaktion/engine");
  return { ok: true, genbrugt: res.genbrugt };
}

export async function scoreVisibleAction(ids: string[]): Promise<{ ok: true; besked: string } | ActionError> {
  const user = await getAuthorizedUser(PERMISSIONS.ARTICLE_AI_USE);
  if (!user) return { ok: false, error: "Du har ikke adgang til AI i artikelarbejdet." };
  const limited = await guardAdminAction({ action: "score-batch", userId: user.id, limit: 12, windowMs: 10 * 60_000 });
  if (limited) return { ok: false, error: limited };
  const res = await scoreSignals(user, (Array.isArray(ids) ? ids : []).map(String));
  if (!res.ok) return res;
  revalidatePath("/redaktion/engine");
  const fejl = res.fejl.length ? ` ${res.fejl[0]}` : "";
  return { ok: true, besked: `${res.vurderet} vurderet${res.genbrugt ? `, ${res.genbrugt} havde allerede en vurdering` : ""}.${fejl}` };
}
