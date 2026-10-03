"use server";

import { redirect } from "next/navigation";
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
