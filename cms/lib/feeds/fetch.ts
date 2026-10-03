import "server-only";
import { createHash } from "node:crypto";
import * as cheerio from "cheerio";
import type { AuthorizedUser } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { signalInputSchema } from "@/lib/ingest/schema";
import { upsertSignal } from "@/lib/ingest/signals";
import { can, PERMISSIONS } from "@/lib/permissions";
import { checkRobots } from "@/lib/net/robots";
import { FEED_CONTENT_TYPES, PAGE_CONTENT_TYPES, safeFetch, type SafeFetchDeps } from "@/lib/net/safe-fetch";
import { htmlToText } from "@/lib/text/html-text";
import { matchesKeywords, parseFeedContent } from "./parse";

/**
 * Manuel hentning af ét feed (ADR-016: kun når en redaktør beder om det). Hvert element bliver et signal, der er maskinindsamlet
 * og UGODKENDT, så det først vises offentligt efter en redaktørs godkendelse. Links i feedet hentes aldrig (S16): de gemmes som tekst.
 * Fejl gemmes som en kort tekst på feedet, aldrig som svarindhold.
 */
export type FetchOutcome =
  | { ok: true; navn: string; nye: number; opdaterede: number; uaendrede: number; filtreret: number; besked: string }
  | { ok: false; navn?: string; error: string };

const MAX_PER_BATCH = 10;
const stableId = (feedId: string, key: string) => `feed-${feedId}-${createHash("sha256").update(key).digest("hex").slice(0, 24)}`;

async function record(feedId: string, instansId: string, status: "ok" | "fejl", antal: number | null, besked: string) {
  await db.feedDefinition.updateMany({ where: { id: feedId, instansId }, data: { sidstHentet: new Date(), sidsteStatus: status, sidsteAntal: antal, sidsteBesked: besked.slice(0, 200) } });
}

export async function fetchFeedNow(user: AuthorizedUser, id: string, deps: SafeFetchDeps = {}): Promise<FetchOutcome> {
  if (!can(user, PERMISSIONS.CONTROLROOM_MANAGE)) return { ok: false, error: "Du har ikke adgang til at hente feeds." };
  const feed = await db.feedDefinition.findFirst({ where: { id: String(id), instansId: user.instansId } });
  if (!feed) return { ok: false, error: "Feedet findes ikke." };
  const fail = async (error: string): Promise<FetchOutcome> => {
    await record(feed.id, user.instansId, "fejl", null, error);
    return { ok: false, navn: feed.navn, error };
  };
  if (feed.type !== "rss" && feed.type !== "web") return { ok: false, navn: feed.navn, error: "Denne type hentes af agenten, ikke af CMS'et." };
  if (!feed.url) return fail("Feedet mangler en adresse.");

  const robots = await checkRobots(feed.url, deps);
  if (!robots.allowed) return fail("Kilden forbyder automatisk hentning i sin robots.txt.");
  const res = await safeFetch(feed.url, { contentTypes: feed.type === "rss" ? FEED_CONTENT_TYPES : PAGE_CONTENT_TYPES, maxBytes: feed.type === "rss" ? 5 * 1024 * 1024 : 1024 * 1024 }, deps);
  if (!res.ok) return fail(res.message);

  const inkluder = Array.isArray(feed.inkluder) ? (feed.inkluder as string[]) : [];
  const ekskluder = Array.isArray(feed.ekskluder) ? (feed.ekskluder as string[]) : [];
  const sourceType = (feed.sourceType ?? "andet") as never;
  const geo = feed.omraadeTekst ?? undefined;
  const counts = { nye: 0, opdaterede: 0, uaendrede: 0, filtreret: 0 };

  const submit = async (externalId: string, overskrift: string, tekst: string, kildeUrl: string, dato: Date | null) => {
    const parsed = signalInputSchema.safeParse({ externalId, overskrift, braedtekst: tekst || undefined, kilde: feed.navn, kildeUrl, sourceType, ...(geo ? { geo } : {}), ...(dato ? { publishedAt: dato.toISOString() } : {}), meta: { feedId: feed.id, hentet: "manuelt" } });
    if (!parsed.success) {
      counts.filtreret++;
      return;
    }
    const out = await upsertSignal(user.instansId, null, parsed.data);
    if (out.status === "created") counts.nye++;
    else if (out.status === "updated") counts.opdaterede++;
    else counts.uaendrede++;
  };

  const body = res.body.toString("utf8");
  if (feed.type === "rss") {
    const parsed = parseFeedContent(body);
    if (!parsed.ok) return fail(parsed.error.includes("RSS") ? "Adressen er ikke et RSS- eller Atom-feed. Skift typen til Webside, hvis det er en almindelig side." : parsed.error);
    for (const item of parsed.items) {
      if (!item.url || !matchesKeywords(item, inkluder, ekskluder)) {
        counts.filtreret++;
        continue;
      }
      await submit(stableId(feed.id, item.id), item.titel, item.tekst, item.url, item.dato);
    }
  } else {
    const $ = cheerio.load(body);
    const title = ($("title").first().text() || feed.navn).replace(/\s+/g, " ").trim().slice(0, 300);
    const text = htmlToText($("main").length ? ($("main").first().html() ?? body) : body, 3000);
    if (!matchesKeywords({ titel: title, tekst: text }, inkluder, ekskluder)) counts.filtreret++;
    else await submit(stableId(feed.id, "side"), title.length >= 3 ? title : feed.navn, text, feed.url, null);
  }

  const besked = `${counts.nye} nye, ${counts.opdaterede} ændrede, ${counts.uaendrede} uændrede${counts.filtreret ? `, ${counts.filtreret} sorteret fra` : ""}.`;
  await record(feed.id, user.instansId, "ok", counts.nye + counts.opdaterede, besked);
  await writeAudit(db, { instansId: user.instansId, actorId: user.id, actorLabel: user.name, action: "feed.fetch", targetId: feed.id, targetLabel: feed.navn, detail: { nye: counts.nye, opdaterede: counts.opdaterede, uaendrede: counts.uaendrede, filtreret: counts.filtreret } });
  return { ok: true, navn: feed.navn, ...counts, besked };
}

/** Hent de aktive feeds (højst 10 ad gangen, de ældst hentede først). Ét ad gangen, så ingen vært belastes. */
export async function fetchActiveFeeds(user: AuthorizedUser, deps: SafeFetchDeps = {}): Promise<{ ok: true; resultater: FetchOutcome[]; tilbage: number } | { ok: false; error: string }> {
  if (!can(user, PERMISSIONS.CONTROLROOM_MANAGE)) return { ok: false, error: "Du har ikke adgang til at hente feeds." };
  const feeds = await db.feedDefinition.findMany({ where: { instansId: user.instansId, aktiv: true, type: { in: ["rss", "web"] }, url: { not: null } }, orderBy: [{ sidstHentet: { sort: "asc", nulls: "first" } }, { prioritet: "asc" }], select: { id: true } });
  const batch = feeds.slice(0, MAX_PER_BATCH);
  const resultater: FetchOutcome[] = [];
  for (const f of batch) resultater.push(await fetchFeedNow(user, f.id, deps));
  return { ok: true, resultater, tilbage: Math.max(0, feeds.length - batch.length) };
}
