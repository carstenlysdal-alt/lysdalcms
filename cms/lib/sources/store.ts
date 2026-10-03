import "server-only";
import type { AuthorizedUser } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { DEFAULT_PROFILES, type SourceProfileLite } from "@/lib/engine/source-rating";
import { can, PERMISSIONS } from "@/lib/permissions";
import { parseSourceProfileInput, type SourceProfileInput } from "./input";

/** Kilderegisteret (SourceProfile): redaktionens egen vurdering af kilder. Alle funktioner er instansafgrænsede. */
export type SourceProfileRow = SourceProfileLite & { id: string; aktiv: boolean; createdAt: Date; updatedAt: Date };
export type SourceResult = { ok: true; besked: string } | { ok: false; error: string };

const denied: SourceResult = { ok: false, error: "Du har ikke adgang til at ændre kilderegisteret." };
const allowed = (user: AuthorizedUser) => can(user, PERMISSIONS.CONTROLROOM_MANAGE);
const isUnique = (e: unknown) => typeof e === "object" && e !== null && (e as { code?: string }).code === "P2002";

export async function listSourceProfiles(instansId: string): Promise<SourceProfileRow[]> {
  return db.sourceProfile.findMany({ where: { instansId }, orderBy: [{ aktiv: "desc" }, { score: "desc" }, { navn: "asc" }] });
}

/** Aktive poster til ratingen (kun de felter, ratingen bruger). */
export async function loadActiveSourceProfiles(instansId: string): Promise<SourceProfileLite[]> {
  const rows = await db.sourceProfile.findMany({ where: { instansId, aktiv: true }, select: { navn: true, type: true, domaene: true, score: true, note: true, aktiv: true } });
  return rows;
}

async function log(user: AuthorizedUser, action: string, id: string, navn: string, detail: Record<string, string | number | boolean | null> = {}) {
  await writeAudit(db, { instansId: user.instansId, actorId: user.id, actorLabel: user.name, action, targetId: id, targetLabel: navn, detail });
}

export async function createSourceProfile(user: AuthorizedUser, raw: Parameters<typeof parseSourceProfileInput>[0]): Promise<SourceResult> {
  if (!allowed(user)) return denied;
  const parsed = parseSourceProfileInput(raw);
  if (!parsed.ok) return parsed;
  try {
    const row = await db.sourceProfile.create({ data: { ...parsed.value, instansId: user.instansId } });
    await log(user, "source.create", row.id, row.navn, { score: row.score });
    return { ok: true, besked: `${row.navn} er tilføjet kilderegisteret.` };
  } catch (e) {
    if (isUnique(e)) return { ok: false, error: "Der findes allerede en kilde med det navn." };
    throw e;
  }
}

export async function updateSourceProfile(user: AuthorizedUser, id: string, raw: Parameters<typeof parseSourceProfileInput>[0]): Promise<SourceResult> {
  if (!allowed(user)) return denied;
  const parsed = parseSourceProfileInput(raw);
  if (!parsed.ok) return parsed;
  try {
    const res = await db.sourceProfile.updateMany({ where: { id: String(id), instansId: user.instansId }, data: parsed.value as SourceProfileInput });
    if (res.count !== 1) return { ok: false, error: "Kilden findes ikke." };
    await log(user, "source.update", String(id), parsed.value.navn, { score: parsed.value.score, aktiv: parsed.value.aktiv });
    return { ok: true, besked: "Kilden er gemt." };
  } catch (e) {
    if (isUnique(e)) return { ok: false, error: "Der findes allerede en kilde med det navn." };
    throw e;
  }
}

export async function deleteSourceProfile(user: AuthorizedUser, id: string): Promise<SourceResult> {
  if (!allowed(user)) return denied;
  const row = await db.sourceProfile.findFirst({ where: { id: String(id), instansId: user.instansId }, select: { id: true, navn: true } });
  if (!row) return { ok: false, error: "Kilden findes ikke." };
  await db.sourceProfile.delete({ where: { id: row.id } });
  await log(user, "source.delete", row.id, row.navn);
  return { ok: true, besked: `${row.navn} er fjernet.` };
}

/** Opretter de standardkilder, der mangler (på navn). Rører aldrig eksisterende poster. */
export async function importDefaultSourceProfiles(user: AuthorizedUser): Promise<SourceResult> {
  if (!allowed(user)) return denied;
  const existing = await db.sourceProfile.findMany({ where: { instansId: user.instansId }, select: { navn: true } });
  const have = new Set(existing.map((r) => r.navn.toLowerCase()));
  const missing = DEFAULT_PROFILES.filter((p) => !have.has(p.navn.toLowerCase()));
  if (missing.length === 0) return { ok: true, besked: "Alle standardkilder findes allerede." };
  await db.sourceProfile.createMany({ data: missing.map((p) => ({ instansId: user.instansId, navn: p.navn, type: p.type, domaene: p.domaene, score: p.score, aktiv: true })) });
  await log(user, "source.import", "standard", "Standardkilder", { antal: missing.length });
  return { ok: true, besked: `${missing.length} standardkilder er tilføjet.` };
}
