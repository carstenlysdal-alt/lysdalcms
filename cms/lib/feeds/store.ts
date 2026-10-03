import "server-only";
import type { AuthorizedUser } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { can, PERMISSIONS } from "@/lib/permissions";
import { canAccessInstance } from "@/lib/instance-access";
import { cleanText } from "@/lib/validation/text";
import { catalogRowToFeed, getCatalogPack, replaceName } from "./catalog";
import { parseFeedInput, type FeedInput } from "./input";

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
  kategori: string | null;
  prioritet: number;
  sidstHentet: Date | null;
  sidsteStatus: string | null;
  sidsteAntal: number | null;
  sidsteBesked: string | null;
  updatedAt: Date;
};
export type FeedResult = { ok: true; besked: string } | { ok: false; error: string };

const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
const denied: FeedResult = { ok: false, error: "Du har ikke adgang til at ændre feeds." };
const isUnique = (e: unknown) => typeof e === "object" && e !== null && (e as { code?: string }).code === "P2002";

export async function listFeeds(instansId: string, opts: { onlyActive?: boolean } = {}): Promise<FeedRow[]> {
  const rows = await db.feedDefinition.findMany({ where: { instansId, ...(opts.onlyActive ? { aktiv: true } : {}) }, orderBy: [{ aktiv: "desc" }, { prioritet: "asc" }, { navn: "asc" }] });
  return rows.map((r) => ({ id: r.id, navn: r.navn, type: r.type, url: r.url, sourceType: r.sourceType, omraadeTekst: r.omraadeTekst, inkluder: strings(r.inkluder), ekskluder: strings(r.ekskluder), intervalMin: r.intervalMin, aktiv: r.aktiv, noter: r.noter, kategori: r.kategori, prioritet: r.prioritet, sidstHentet: r.sidstHentet, sidsteStatus: r.sidsteStatus, sidsteAntal: r.sidsteAntal, sidsteBesked: r.sidsteBesked, updatedAt: r.updatedAt }));
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

// ── Kildepakke: massehandlinger, katalog og kopiering mellem byer ────────────

export type BulkPatch = { aktiv?: boolean; prioritet?: number; kategori?: string | null; intervalMin?: number };
export type BulkResult = { ok: true; besked: string; antal: number } | { ok: false; error: string };

const deniedBulk = { ok: false as const, error: denied.error };
const uniqueIds = (ids: readonly unknown[]) => Array.from(new Set(ids.filter((i): i is string => typeof i === "string" && i.length > 0 && i.length <= 64))).slice(0, 500);

/** Ændr flere feeds på én gang (aktivér, prioritet, kategori, interval). Aktivering springer kladder uden adresse over. */
export async function bulkUpdateFeeds(user: AuthorizedUser, rawIds: readonly unknown[], patch: BulkPatch): Promise<BulkResult> {
  if (!can(user, PERMISSIONS.CONTROLROOM_MANAGE)) return deniedBulk;
  const ids = uniqueIds(rawIds);
  if (ids.length === 0) return { ok: false, error: "Vælg mindst ét feed." };
  const data: { aktiv?: boolean; prioritet?: number; kategori?: string | null; intervalMin?: number } = {};
  if (patch.prioritet !== undefined) {
    if (!Number.isInteger(patch.prioritet) || patch.prioritet < 1 || patch.prioritet > 3) return { ok: false, error: "Prioriteten skal være 1, 2 eller 3." };
    data.prioritet = patch.prioritet;
  }
  if (patch.intervalMin !== undefined) {
    if (!Number.isInteger(patch.intervalMin) || patch.intervalMin < 5 || patch.intervalMin > 1440) return { ok: false, error: "Intervallet skal være mellem 5 og 1440 minutter." };
    data.intervalMin = patch.intervalMin;
  }
  if (patch.kategori !== undefined) data.kategori = cleanText(patch.kategori, 60) || null;
  if (patch.aktiv !== undefined) data.aktiv = patch.aktiv;
  if (Object.keys(data).length === 0) return { ok: false, error: "Vælg, hvad der skal ændres." };

  let skipped = 0;
  let targets = ids;
  if (data.aktiv === true) {
    const rows = await db.feedDefinition.findMany({ where: { id: { in: ids }, instansId: user.instansId }, select: { id: true, type: true, url: true } });
    const ready = rows.filter((r) => r.type === "mail" || (r.url && r.url.trim()));
    skipped = rows.length - ready.length;
    targets = ready.map((r) => r.id);
    if (targets.length === 0) return { ok: false, error: "Ingen af de valgte feeds har en adresse endnu. Udfyld adresserne, før de slås til." };
  }
  const res = await db.feedDefinition.updateMany({ where: { id: { in: targets }, instansId: user.instansId }, data });
  await writeAudit(db, { instansId: user.instansId, actorId: user.id, actorLabel: user.name, action: "feed.bulk", targetId: null, targetLabel: `${res.count} feeds`, detail: { antal: res.count, ...(data.aktiv !== undefined ? { aktiv: data.aktiv } : {}), ...(data.prioritet !== undefined ? { prioritet: data.prioritet } : {}) } });
  const extra = skipped ? ` ${skipped} blev sprunget over, fordi de mangler en adresse.` : "";
  return { ok: true, antal: res.count, besked: `${res.count} feeds er opdateret.${extra}` };
}

export async function deleteFeeds(user: AuthorizedUser, rawIds: readonly unknown[]): Promise<BulkResult> {
  if (!can(user, PERMISSIONS.CONTROLROOM_MANAGE)) return deniedBulk;
  const ids = uniqueIds(rawIds);
  if (ids.length === 0) return { ok: false, error: "Vælg mindst ét feed." };
  const res = await db.feedDefinition.deleteMany({ where: { id: { in: ids }, instansId: user.instansId } });
  await writeAudit(db, { instansId: user.instansId, actorId: user.id, actorLabel: user.name, action: "feed.bulk-delete", targetId: null, targetLabel: `${res.count} feeds`, detail: { antal: res.count } });
  return { ok: true, antal: res.count, besked: `${res.count} feeds er fjernet.` };
}

/** Importér en kildekatalog (Slagelse eller Næstved) som inaktive kladder uden adresse. Eksisterende navne røres ikke. */
export async function importCatalog(user: AuthorizedUser, packId: string, opts: { replaceFrom?: string; replaceTo?: string; maxPri?: number } = {}): Promise<BulkResult> {
  if (!can(user, PERMISSIONS.CONTROLROOM_MANAGE)) return deniedBulk;
  const pack = getCatalogPack(packId);
  if (!pack) return { ok: false, error: "Kataloget findes ikke." };
  const from = cleanText(opts.replaceFrom, 60);
  const to = cleanText(opts.replaceTo, 60);
  const replace = from && to ? { from, to } : undefined;
  const maxPri = opts.maxPri === 0 || opts.maxPri === 1 ? opts.maxPri : 2;
  const existing = new Set((await db.feedDefinition.findMany({ where: { instansId: user.instansId }, select: { navn: true } })).map((r) => r.navn.toLowerCase()));
  const created: FeedInput[] = [];
  for (const row of pack.rows) {
    if (row.pri > maxPri) continue;
    const feed = catalogRowToFeed(row, { replace });
    if (feed.navn.length < 2 || existing.has(feed.navn.toLowerCase())) continue;
    existing.add(feed.navn.toLowerCase());
    created.push(feed);
  }
  if (created.length === 0) return { ok: true, antal: 0, besked: "Alle kilder fra kataloget findes allerede." };
  await db.$transaction(created.map((f) => db.feedDefinition.create({ data: { ...f, instansId: user.instansId } })));
  await writeAudit(db, { instansId: user.instansId, actorId: user.id, actorLabel: user.name, action: "feed.import", targetId: null, targetLabel: pack.navn, detail: { katalog: pack.id, antal: created.length } });
  return { ok: true, antal: created.length, besked: `${created.length} kilder er hentet ind som kladder. De er slået fra, til du har udfyldt adresserne.` };
}

export type CloneOptions = {
  targetInstansId: string;
  /** Tom = hele pakken. */
  ids?: readonly unknown[];
  replaceFrom?: string;
  replaceTo?: string;
  keepUrls?: boolean;
  includeRatings?: boolean;
};

/**
 * Kopiér hele kildepakken (eller en del af den) til en anden by, brugeren har adgang til. Kopierne er altid slået fra, så intet
 * hentes, før redaktionen har tjekket adresserne. By-navn kan erstattes i navne, noter og nøgleord ("Slagelse" -> "Køge").
 */
export async function cloneFeeds(user: AuthorizedUser, opts: CloneOptions): Promise<BulkResult> {
  if (!can(user, PERMISSIONS.CONTROLROOM_MANAGE)) return deniedBulk;
  const targetId = String(opts.targetInstansId ?? "");
  if (!targetId || targetId === user.instansId) return { ok: false, error: "Vælg en anden by at kopiere til." };
  if (!(await canAccessInstance(user, targetId))) return { ok: false, error: "Du har ikke adgang til den valgte by." };
  const target = await db.instance.findUnique({ where: { id: targetId }, select: { id: true, navn: true } });
  if (!target) return { ok: false, error: "Byen findes ikke." };

  const ids = uniqueIds(opts.ids ?? []);
  const source = await db.feedDefinition.findMany({ where: { instansId: user.instansId, ...(ids.length ? { id: { in: ids } } : {}) }, orderBy: [{ prioritet: "asc" }, { navn: "asc" }] });
  if (source.length === 0) return { ok: false, error: "Der er ingen feeds at kopiere." };

  const from = cleanText(opts.replaceFrom, 60);
  const to = cleanText(opts.replaceTo, 60);
  const r = (text: string) => (from && to ? replaceName(text, from, to) : text);
  const existing = new Set((await db.feedDefinition.findMany({ where: { instansId: targetId }, select: { navn: true } })).map((x) => x.navn.toLowerCase()));

  const rows: Array<Omit<FeedInput, "aktiv"> & { aktiv: false }> = [];
  for (const f of source) {
    const navn = cleanText(r(f.navn), 80);
    if (navn.length < 2 || existing.has(navn.toLowerCase())) continue;
    existing.add(navn.toLowerCase());
    rows.push({
      navn,
      type: f.type as FeedInput["type"],
      url: opts.keepUrls === false ? null : f.url,
      sourceType: f.sourceType,
      omraadeTekst: f.omraadeTekst ? cleanText(r(f.omraadeTekst), 120) || null : null,
      inkluder: strings(f.inkluder).map((w) => cleanText(r(w), 40)).filter((w) => w.length >= 2),
      ekskluder: strings(f.ekskluder),
      intervalMin: f.intervalMin,
      aktiv: false,
      noter: f.noter ? cleanText(r(f.noter), 300, { multiline: true }) || null : null,
      kategori: f.kategori,
      prioritet: f.prioritet,
    });
  }
  const skipped = source.length - rows.length;
  if (rows.length > 0) await db.$transaction(rows.map((row) => db.feedDefinition.create({ data: { ...row, instansId: targetId } })));

  let ratings = 0;
  if (opts.includeRatings) {
    const profiles = await db.sourceProfile.findMany({ where: { instansId: user.instansId } });
    const have = new Set((await db.sourceProfile.findMany({ where: { instansId: targetId }, select: { navn: true } })).map((x) => x.navn.toLowerCase()));
    const fresh = profiles.filter((p) => !have.has(p.navn.toLowerCase()));
    if (fresh.length) await db.$transaction(fresh.map((p) => db.sourceProfile.create({ data: { instansId: targetId, navn: p.navn, type: p.type, domaene: p.domaene, score: p.score, note: p.note, aktiv: p.aktiv } })));
    ratings = fresh.length;
  }
  await writeAudit(db, { instansId: targetId, actorId: user.id, actorLabel: user.name, action: "feed.clone", targetId: null, targetLabel: target.navn, detail: { fraInstans: user.instansId, antal: rows.length, sprungetOver: skipped, kilderatings: ratings } });
  const parts = [`${rows.length} feeds er kopieret til ${target.navn}`];
  if (opts.includeRatings) parts.push(`${ratings} kilderatings`);
  const tail = skipped ? ` ${skipped} fandtes allerede og blev sprunget over.` : "";
  return { ok: true, antal: rows.length, besked: `${parts.join(" og ")}. Kopierne er slået fra, til du har tjekket adresserne.${tail}` };
}
