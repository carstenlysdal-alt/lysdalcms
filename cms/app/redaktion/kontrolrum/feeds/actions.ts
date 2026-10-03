"use server";

import { revalidatePath } from "next/cache";
import { getAuthorizedUser } from "@/lib/auth";
import { createFeed, deleteFeed, updateFeed, type FeedResult } from "@/lib/feeds/store";
import { PERMISSIONS } from "@/lib/permissions";

/** Handlinger i feed-editoren. Rettigheden controlroom.manage slås op i databasen og kontrolleres igen i store-laget. */
export type FeedFormState = { ok?: boolean; besked?: string; error?: string };

const field = (fd: FormData, key: string) => (typeof fd.get(key) === "string" ? (fd.get(key) as string) : "");
const raw = (fd: FormData) => ({
  navn: field(fd, "navn"), type: field(fd, "type"), url: field(fd, "url"), sourceType: field(fd, "sourceType"), omraadeTekst: field(fd, "omraadeTekst"),
  inkluder: field(fd, "inkluder"), ekskluder: field(fd, "ekskluder"), intervalMin: field(fd, "intervalMin"), noter: field(fd, "noter"), aktiv: fd.get("aktiv") === "on",
});

function done(res: FeedResult): FeedFormState {
  if (res.ok) {
    revalidatePath("/redaktion/kontrolrum/feeds");
    revalidatePath("/redaktion/kontrolrum");
    return { ok: true, besked: res.besked };
  }
  return { error: res.error };
}

const denied: FeedFormState = { error: "Du har ikke adgang til at ændre feeds." };

export async function createFeedAction(_prev: FeedFormState, fd: FormData): Promise<FeedFormState> {
  const u = await getAuthorizedUser(PERMISSIONS.CONTROLROOM_MANAGE);
  return u ? done(await createFeed(u, raw(fd))) : denied;
}
export async function updateFeedAction(_prev: FeedFormState, fd: FormData): Promise<FeedFormState> {
  const u = await getAuthorizedUser(PERMISSIONS.CONTROLROOM_MANAGE);
  return u ? done(await updateFeed(u, field(fd, "id"), raw(fd))) : denied;
}
export async function deleteFeedAction(_prev: FeedFormState, fd: FormData): Promise<FeedFormState> {
  const u = await getAuthorizedUser(PERMISSIONS.CONTROLROOM_MANAGE);
  return u ? done(await deleteFeed(u, field(fd, "id"))) : denied;
}
