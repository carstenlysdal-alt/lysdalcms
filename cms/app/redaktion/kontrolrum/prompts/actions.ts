"use server";

import { revalidatePath } from "next/cache";
import { getAuthorizedUser } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { resetPrompt, restorePrompt, savePrompt, type PromptResult } from "@/lib/prompts/store";

/** Handlinger i prompt-editoren. Rettigheden (controlroom.manage) slås op i databasen og kontrolleres igen i store-laget. */
export type PromptFormState = { ok?: boolean; besked?: string; error?: string; konflikt?: boolean };

const text = (fd: FormData, key: string) => (typeof fd.get(key) === "string" ? (fd.get(key) as string) : "");
const baseVersionOf = (fd: FormData) => {
  const n = Number(text(fd, "baseVersion"));
  return Number.isInteger(n) && n >= 0 ? n : null;
};

function toState(res: PromptResult, noegle: string): PromptFormState {
  if (res.ok) {
    revalidatePath("/redaktion/kontrolrum/prompts");
    revalidatePath(`/redaktion/kontrolrum/prompts/${noegle}`);
    revalidatePath("/redaktion/kontrolrum");
    return { ok: true, besked: res.besked };
  }
  return { error: res.error, konflikt: res.konflikt };
}

export async function savePromptAction(_prev: PromptFormState, fd: FormData): Promise<PromptFormState> {
  const user = await getAuthorizedUser(PERMISSIONS.CONTROLROOM_MANAGE);
  if (!user) return { error: "Du har ikke adgang til at ændre prompts." };
  const noegle = text(fd, "noegle");
  return toState(await savePrompt(user, noegle, text(fd, "indhold"), { note: text(fd, "note"), baseVersion: baseVersionOf(fd) }), noegle);
}

export async function resetPromptAction(_prev: PromptFormState, fd: FormData): Promise<PromptFormState> {
  const user = await getAuthorizedUser(PERMISSIONS.CONTROLROOM_MANAGE);
  if (!user) return { error: "Du har ikke adgang til at ændre prompts." };
  const noegle = text(fd, "noegle");
  return toState(await resetPrompt(user, noegle, { baseVersion: baseVersionOf(fd) }), noegle);
}

export async function restorePromptAction(_prev: PromptFormState, fd: FormData): Promise<PromptFormState> {
  const user = await getAuthorizedUser(PERMISSIONS.CONTROLROOM_MANAGE);
  if (!user) return { error: "Du har ikke adgang til at ændre prompts." };
  const noegle = text(fd, "noegle");
  const version = Number(text(fd, "version"));
  if (!Number.isInteger(version) || version < 1) return { error: "Ugyldig version." };
  return toState(await restorePrompt(user, noegle, version, { baseVersion: baseVersionOf(fd) }), noegle);
}
