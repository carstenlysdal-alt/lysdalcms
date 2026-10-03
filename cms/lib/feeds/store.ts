import "server-only";
import type { AuthorizedUser } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { can, PERMISSIONS } from "@/lib/permissions";
import { parseFeedInput } from "./input";

/** Feed-definitioner: hvad agenterne skal overvåge. Agenten henter dem via GET /api/ingest/feeds. Instansafgrænset. */
export type FeedRow = {
  id: string;
  navn: string;
  type: string;
  url: string | null;
  sourceType: string | null;
  omraadeTekst: string | null;
  inkluder: string[];
  ekskluder: string[];
  intervalMin: number;
  aktiv: boolean;
  noter: string | null;
  updatedAt: Date;
};
export type FeedResult = { ok: true; besked: string } | { ok: false; error: string };

const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
const denied: FeedResult = { ok: false, error: "Du har ikke adgang til at ændre feeds." };
const isUnique = (e: unknown) => typeof e === "object" && e !== null && (e as { code?: string }).code === "P2002";

export async function listFeeds(instansId: string, opts: { onlyActive?: boolean } = {}): Promise<FeedRow[]> {
  const rows = await db.feedDefinition.findMany({ where: { instansId, ...(opts.onlyActive ? { aktiv: true } : {}) }, orderBy: [{ aktiv: "desc" }, { navn: "asc" }] });
  return rows.map((r) => ({ id: r.id, navn: r.navn, type: r.type, url: r.url, sourceType: r.sourceType, omraadeTekst: r.omraadeTekst, inkluder: strings(r.inkluder), ekskluder: strings(r.ekskluder), intervalMin: r.intervalMin, aktiv: r.aktiv, noter: r.noter, updatedAt: r.updatedAt }));
}

async function log(user: AuthorizedUser, action: string, id: string, navn: string, detail: Record<string, string | number | boolean | null> = {}) {
  await writeAudit(db, { instansId: user.instansId, actorId: user.id, actorLabel: user.name, action, targetId: id, targetLabel: navn, detail });
}

export async function createFeed(user: AuthorizedUser, raw: Record<string, unknown>): Promise<FeedResult> {
  if (!can(user, PERMISSIONS.CONTROLROOM_MANAGE)) return denied;
  const parsed = parseFeedInput(raw);
  if (!parsed.ok) return parsed;
  try {
    const row = await db.feedDefinition.create({ data: { ...parsed.value, instansId: user.instansId } });
    await log(user, "feed.create", row.id, row.navn, { type: row.type });
    return { ok: true, besked: `${row.navn} er tilføjet.` };
  } catch (e) {
    if (isUnique(e)) return { ok: false, error: "Der findes allerede et feed med det navn." };
    throw e;
  }
}

export async function updateFeed(user: AuthorizedUser, id: string, raw: Record<string, unknown>): Promise<FeedResult> {
  if (!can(user, PERMISSIONS.CONTROLROOM_MANAGE)) return denied;
  const parsed = parseFeedInput(raw);
  if (!parsed.ok) return parsed;
  try {
    const res = await db.feedDefinition.updateMany({ where: { id: String(id), instansId: user.instansId }, data: parsed.value });
    if (res.count !== 1) return { ok: false, error: "Feedet findes ikke." };
    await log(user, "feed.update", String(id), parsed.value.navn, { aktiv: parsed.value.aktiv });
    return { ok: true, besked: "Feedet er gemt." };
  } catch (e) {
    if (isUnique(e)) return { ok: false, error: "Der findes allerede et feed med det navn." };
    throw e;
  }
}

export async function deleteFeed(user: AuthorizedUser, id: string): Promise<FeedResult> {
  if (!can(user, PERMISSIONS.CONTROLROOM_MANAGE)) return denied;
  const row = await db.feedDefinition.findFirst({ where: { id: String(id), instansId: user.instansId }, select: { id: true, navn: true } });
  if (!row) return { ok: false, error: "Feedet findes ikke." };
  await db.feedDefinition.delete({ where: { id: row.id } });
  await log(user, "feed.delete", row.id, row.navn);
  return { ok: true, besked: `${row.navn} er fjernet.` };
}
