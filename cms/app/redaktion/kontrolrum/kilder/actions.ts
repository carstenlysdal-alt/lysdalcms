"use server";

import { revalidatePath } from "next/cache";
import { getAuthorizedUser } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { createSourceProfile, deleteSourceProfile, importDefaultSourceProfiles, updateSourceProfile, type SourceResult } from "@/lib/sources/store";

/** Handlinger i kilderegisteret. Rettigheden controlroom.manage slås op i databasen og kontrolleres igen i store-laget. */
export type SourceFormState = { ok?: boolean; besked?: string; error?: string };

const field = (fd: FormData, key: string) => (typeof fd.get(key) === "string" ? (fd.get(key) as string) : "");
const raw = (fd: FormData) => ({ navn: field(fd, "navn"), type: field(fd, "type"), domaene: field(fd, "domaene"), score: field(fd, "score"), note: field(fd, "note"), aktiv: fd.get("aktiv") === "on" });

function done(res: SourceResult): SourceFormState {
  if (res.ok) {
    revalidatePath("/redaktion/kontrolrum/kilder");
    revalidatePath("/redaktion/kontrolrum");
    revalidatePath("/redaktion/engine");
    return { ok: true, besked: res.besked };
  }
  return { error: res.error };
}

async function user() {
  return getAuthorizedUser(PERMISSIONS.CONTROLROOM_MANAGE);
}

export async function createSourceAction(_prev: SourceFormState, fd: FormData): Promise<SourceFormState> {
  const u = await user();
  return u ? done(await createSourceProfile(u, raw(fd))) : { error: "Du har ikke adgang til at ændre kilderegisteret." };
}

export async function updateSourceAction(_prev: SourceFormState, fd: FormData): Promise<SourceFormState> {
  const u = await user();
  return u ? done(await updateSourceProfile(u, field(fd, "id"), raw(fd))) : { error: "Du har ikke adgang til at ændre kilderegisteret." };
}

export async function deleteSourceAction(_prev: SourceFormState, fd: FormData): Promise<SourceFormState> {
  const u = await user();
  return u ? done(await deleteSourceProfile(u, field(fd, "id"))) : { error: "Du har ikke adgang til at ændre kilderegisteret." };
}

export async function importDefaultsAction(): Promise<SourceFormState> {
  const u = await user();
  return u ? done(await importDefaultSourceProfiles(u)) : { error: "Du har ikke adgang til at ændre kilderegisteret." };
}
