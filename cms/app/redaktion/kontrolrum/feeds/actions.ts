"use server";

import { revalidatePath } from "next/cache";
import { guardAdminAction } from "@/lib/admin-guard";
import { getAuthorizedUser } from "@/lib/auth";
import { fetchActiveFeeds, fetchFeedNow } from "@/lib/feeds/fetch";
import { bulkUpdateFeeds, cloneFeeds, createFeed, deleteFeed, deleteFeeds, importCatalog, updateFeed, type BulkResult, type FeedResult } from "@/lib/feeds/store";
import { PERMISSIONS } from "@/lib/permissions";

/** Handlinger i kildepakken. Rettigheden controlroom.manage slås op i databasen og kontrolleres igen i store-laget. */
export type FeedFormState = { ok?: boolean; besked?: string; error?: string; detaljer?: string[] };

const field = (fd: FormData, key: string) => (typeof fd.get(key) === "string" ? (fd.get(key) as string) : "");
const raw = (fd: FormData) => ({
  navn: field(fd, "navn"), type: field(fd, "type"), url: field(fd, "url"), sourceType: field(fd, "sourceType"), omraadeTekst: field(fd, "omraadeTekst"),
  inkluder: field(fd, "inkluder"), ekskluder: field(fd, "ekskluder"), intervalMin: field(fd, "intervalMin"), noter: field(fd, "noter"), aktiv: fd.get("aktiv") === "on",
  kategori: field(fd, "kategori"), prioritet: field(fd, "prioritet") || "2",
});

function revalidate() {
  revalidatePath("/redaktion/kontrolrum/feeds");
  revalidatePath("/redaktion/kontrolrum");
  revalidatePath("/redaktion/engine");
}

function done(res: FeedResult | BulkResult): FeedFormState {
  if (res.ok) {
    revalidate();
    return { ok: true, besked: res.besked };
  }
  return { error: res.error };
}

const denied: FeedFormState = { error: "Du har ikke adgang til at ændre feeds." };
const user = () => getAuthorizedUser(PERMISSIONS.CONTROLROOM_MANAGE);

export async function createFeedAction(_prev: FeedFormState, fd: FormData): Promise<FeedFormState> {
  const u = await user();
  return u ? done(await createFeed(u, raw(fd))) : denied;
}
export async function updateFeedAction(_prev: FeedFormState, fd: FormData): Promise<FeedFormState> {
  const u = await user();
  return u ? done(await updateFeed(u, field(fd, "id"), raw(fd))) : denied;
}
export async function deleteFeedAction(_prev: FeedFormState, fd: FormData): Promise<FeedFormState> {
  const u = await user();
  return u ? done(await deleteFeed(u, field(fd, "id"))) : denied;
}

/** Massehandling på de afkrydsede feeds. `op` er en af: til, fra, prioritet, kategori, interval, slet. */
export async function bulkFeedsAction(_prev: FeedFormState, fd: FormData): Promise<FeedFormState> {
  const u = await user();
  if (!u) return denied;
  const ids = fd.getAll("id");
  const op = field(fd, "op");
  if (op === "slet") return done(await deleteFeeds(u, ids));
  if (op === "til") return done(await bulkUpdateFeeds(u, ids, { aktiv: true }));
  if (op === "fra") return done(await bulkUpdateFeeds(u, ids, { aktiv: false }));
  if (op === "prioritet") return done(await bulkUpdateFeeds(u, ids, { prioritet: Number(field(fd, "vaerdi")) }));
  if (op === "interval") return done(await bulkUpdateFeeds(u, ids, { intervalMin: Number(field(fd, "vaerdi")) }));
  if (op === "kategori") return done(await bulkUpdateFeeds(u, ids, { kategori: field(fd, "vaerdi") }));
  return { error: "Ukendt handling." };
}

export async function importCatalogAction(_prev: FeedFormState, fd: FormData): Promise<FeedFormState> {
  const u = await user();
  if (!u) return denied;
  return done(await importCatalog(u, field(fd, "katalog"), { replaceFrom: field(fd, "fra"), replaceTo: field(fd, "til"), maxPri: Number(field(fd, "maxPri") || 2) }));
}

export async function cloneFeedsAction(_prev: FeedFormState, fd: FormData): Promise<FeedFormState> {
  const u = await user();
  if (!u) return denied;
  const scope = field(fd, "omfang");
  return done(await cloneFeeds(u, { targetInstansId: field(fd, "by"), ids: scope === "valgte" ? fd.getAll("id") : [], replaceFrom: field(fd, "fra"), replaceTo: field(fd, "til"), keepUrls: fd.get("behold") === "on", includeRatings: fd.get("ratings") === "on" }));
}

/** Manuel hentning af ét feed. Rate-limitet pr. bruger, så en redaktør ikke ved et uheld belaster eksterne værter. */
export async function fetchFeedAction(_prev: FeedFormState, fd: FormData): Promise<FeedFormState> {
  const u = await user();
  if (!u) return denied;
  const limited = await guardAdminAction({ action: "feed.fetch", userId: u.id, limit: 40, windowMs: 10 * 60_000 });
  if (limited) return { error: limited };
  const res = await fetchFeedNow(u, field(fd, "id"));
  revalidate();
  return res.ok ? { ok: true, besked: res.besked } : { error: res.error };
}

export async function fetchAllAction(): Promise<FeedFormState> {
  const u = await user();
  if (!u) return denied;
  const limited = await guardAdminAction({ action: "feed.fetch", userId: u.id, limit: 40, windowMs: 10 * 60_000 });
  if (limited) return { error: limited };
  const res = await fetchActiveFeeds(u);
  revalidate();
  if (!res.ok) return { error: res.error };
  if (res.resultater.length === 0) return { error: "Ingen aktive feeds at hente. Slå feeds til i kildepakken, og sørg for, at de har en adresse." };
  const nye = res.resultater.reduce((n, r) => n + (r.ok ? r.nye : 0), 0);
  const fejl = res.resultater.filter((r) => !r.ok);
  const detaljer = res.resultater.map((r) => (r.ok ? `${r.navn}: ${r.besked}` : `${r.navn ?? "Feed"}: ${r.error}`));
  const rest = res.tilbage ? ` ${res.tilbage} venter. Tryk igen for at hente dem.` : "";
  const besked = `${res.resultater.length} feeds forsøgt, ${nye} nye signaler${fejl.length ? `, ${fejl.length} fejlede` : ""}.${rest}`;
  return fejl.length === res.resultater.length ? { error: besked, detaljer } : { ok: true, besked, detaljer };
}
