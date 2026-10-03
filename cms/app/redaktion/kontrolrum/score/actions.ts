"use server";

import { revalidatePath } from "next/cache";
import { getAuthorizedUser } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { SCORE_CONFIG_KEY } from "@/lib/prompts/compose";
import { resetPrompt, savePrompt } from "@/lib/prompts/store";
import { stringifyScoreConfig, validateScoreConfig } from "@/lib/score/config";

export type ScoreFormState = { ok?: boolean; besked?: string; error?: string };

function done(res: Awaited<ReturnType<typeof savePrompt>>): ScoreFormState {
  if (!res.ok) return { error: res.error };
  for (const p of ["/redaktion/kontrolrum/score", "/redaktion/kontrolrum/prompts", "/redaktion/kontrolrum/grundlag", "/redaktion/engine"]) revalidatePath(p);
  return { ok: true, besked: res.besked };
}

export async function saveScoreConfigAction(configJson: string, baseVersion: number, note: string): Promise<ScoreFormState> {
  const user = await getAuthorizedUser(PERMISSIONS.CONTROLROOM_MANAGE);
  if (!user) return { error: "Du har ikke adgang til at ændre Local Score." };
  let parsed: unknown;
  try { parsed = JSON.parse(String(configJson)); } catch { return { error: "Konfigurationen kunne ikke læses." }; }
  const valid = validateScoreConfig(parsed);
  if (!valid.ok) return { error: valid.error };
  return done(await savePrompt(user, SCORE_CONFIG_KEY, stringifyScoreConfig(valid.config), { note, baseVersion }));
}

export async function resetScoreConfigAction(baseVersion: number): Promise<ScoreFormState> {
  const user = await getAuthorizedUser(PERMISSIONS.CONTROLROOM_MANAGE);
  if (!user) return { error: "Du har ikke adgang til at ændre Local Score." };
  return done(await resetPrompt(user, SCORE_CONFIG_KEY, { baseVersion }));
}
