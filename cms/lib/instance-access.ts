import type { Prisma, PrismaClient } from "@prisma/client";
import { db } from "./db";
import { writeAudit } from "./audit";
import { cityKey, domainForKey } from "./network-sites";

/**
 * Netværksadgang: ét login kan arbejde i flere byer (instanser).
 *
 *  - Hjemmeinstansen (User.instansId) er ALTID tilladt og gemmes ikke som række.
 *  - Ekstra byer er rækker i UserInstanceAccess. Brugerens ene globale rolle gælder i alle tilladte byer.
 *  - Den AKTIVE by ligger i sessionens JWT (`activeInstansId`) og er kun et ønske: den er først gyldig, når den er hjemmet
 *    eller en række findes i DATABASEN lige nu (`resolveActiveInstance`). Er rækken fjernet, falder brugeren tilbage til
 *    hjemmeinstansen — en forældet claim giver aldrig adgang.
 *
 * Alt her er cross-provider (SQLite/PostgreSQL) og uden afhængighed af next/auth, så scripts og tests kan bruge det direkte.
 */

type Client = PrismaClient | Prisma.TransactionClient;

export type InstanceRef = { id: string; navn: string; domaene: string; key: string; home: boolean };

/** Hjemmeinstansen først, derefter byer med ekstra adgang. Ingen dubletter. */
export async function accessibleInstanceIds(userId: string, homeInstansId: string, client: Client = db): Promise<string[]> {
  const rows = await client.userInstanceAccess.findMany({ where: { userId }, select: { instansId: true } });
  return Array.from(new Set([homeInstansId, ...rows.map((r) => r.instansId)]));
}

/** De byer brugeren må redigere (til skifteren i skallen), hjemmeinstansen først, resten alfabetisk. */
export async function listAccessibleInstances(userId: string, homeInstansId: string, client: Client = db): Promise<InstanceRef[]> {
  const ids = await accessibleInstanceIds(userId, homeInstansId, client);
  const rows = await client.instance.findMany({ where: { id: { in: ids } }, select: { id: true, navn: true, domaene: true } });
  return rows
    .map((r) => ({ id: r.id, navn: r.navn, domaene: r.domaene, key: cityKey(r.domaene), home: r.id === homeInstansId }))
    .sort((a, b) => Number(b.home) - Number(a.home) || a.navn.localeCompare(b.navn, "da"));
}

/** Byer en bruger kan flytte indhold TIL: alle brugerens byer undtagen den aktive. */
export async function listOtherCities(user: { id: string; instansId: string; homeInstansId: string }, client: Client = db): Promise<InstanceRef[]> {
  return (await listAccessibleInstances(user.id, user.homeInstansId, client)).filter((c) => c.id !== user.instansId);
}

/** Må brugeren arbejde i byen? (hjemmeinstans eller adgangsrække, slået op i databasen nu) */
export async function canAccessInstance(user: { id: string; homeInstansId: string }, instansId: string, client: Client = db): Promise<boolean> {
  return (await accessibleInstanceIds(user.id, user.homeInstansId, client)).includes(instansId);
}

export type ResolvedInstance = { instansId: string; fellBack: boolean };

/**
 * Afgør den gyldige aktive instans ud fra et ØNSKE (JWT-claim eller opdateringsanmodning) — altid mod databasen.
 * Første kandidat der er hjemmet eller har en adgangsrække vinder; ellers hjemmeinstansen (`fellBack: true` hvis der var
 * en anden kandidat, som blev afvist). Klienten kan aldrig vælge en instans uden en række.
 */
export async function resolveActiveInstance(args: {
  userId: string;
  homeInstansId: string;
  requested: ReadonlyArray<string | null | undefined> | string | null | undefined;
  client?: Client;
}): Promise<ResolvedInstance> {
  const candidates = (Array.isArray(args.requested) ? args.requested : [args.requested]).filter(
    (c): c is string => typeof c === "string" && c.length > 0 && c.length <= 64,
  );
  let rejected = false;
  for (const candidate of candidates) {
    if (candidate === args.homeInstansId) return { instansId: candidate, fellBack: rejected };
    const row = await (args.client ?? db).userInstanceAccess.findUnique({
      where: { userId_instansId: { userId: args.userId, instansId: candidate } },
      select: { id: true },
    });
    if (row) return { instansId: candidate, fellBack: rejected };
    rejected = true;
  }
  return { instansId: args.homeInstansId, fellBack: rejected };
}

const warned = new Set<string>();
/** Logger ÉN gang pr. proces og (bruger, afvist instans), at en forældet claim blev ignoreret. Ingen hemmeligheder. */
export function warnStaleInstanceClaim(userId: string, instansId: string | null | undefined): void {
  const key = `${userId}:${instansId ?? ""}`;
  if (warned.has(key)) return;
  if (warned.size > 500) warned.clear();
  warned.add(key);
  console.warn(`[instance-access] Ignorerede forældet aktiv instans (${instansId ?? "ukendt"}) for bruger ${userId}; faldt tilbage til hjemmeinstansen.`);
}

// ── Ændring af adgang (fælles for UI-action og script) ───────────────────────

export type AccessPlan =
  | { ok: true; add: string[]; remove: string[] }
  | { ok: false; reason: "uden-for-raekkevidde"; instansId: string };

/**
 * Regler for at ændre en brugers ekstra adgang (ren logik, testbar):
 *  - hjemmeinstansen ignoreres i `desired` (den kan hverken gives eller fjernes — brugeren beholder altid mindst den);
 *  - udføreren må kun TILFØJE eller FJERNE byer, udføreren selv har adgang til (`actorAccessible`).
 */
export function planAccessChange(args: { actorAccessible: readonly string[]; targetHome: string; current: readonly string[]; desired: readonly string[] }): AccessPlan {
  const reach = new Set(args.actorAccessible);
  const current = new Set(args.current.filter((id) => id !== args.targetHome));
  const desired = new Set(args.desired.filter((id) => id !== args.targetHome));
  const add = [...desired].filter((id) => !current.has(id));
  const remove = [...current].filter((id) => !desired.has(id));
  for (const id of [...add, ...remove]) {
    if (!reach.has(id)) return { ok: false, reason: "uden-for-raekkevidde", instansId: id };
  }
  return { ok: true, add, remove };
}

export type AccessActor = { id: string | null; label: string | null; ip?: string | null };

/** Skriver planen (idempotent) med ét revisionsspor pr. ændring, i den by adgangen gælder. Kaldes i en transaktion. */
export async function applyAccessChange(
  client: Client,
  args: { target: { id: string; email: string }; add: readonly string[]; remove: readonly string[]; actor: AccessActor; source: "ui" | "cli" },
): Promise<{ added: string[]; removed: string[] }> {
  const added: string[] = [];
  const removed: string[] = [];
  for (const instansId of args.add) {
    const existing = await client.userInstanceAccess.findUnique({ where: { userId_instansId: { userId: args.target.id, instansId } }, select: { id: true } });
    if (existing) continue;
    await client.userInstanceAccess.create({ data: { userId: args.target.id, instansId, createdBy: args.actor.label ?? "cli" } });
    added.push(instansId);
    await writeAudit(client, { instansId, actorId: args.actor.id, actorLabel: args.actor.label, action: "user.access_grant", targetId: args.target.id, targetLabel: args.target.email, detail: { via: args.source }, ip: args.actor.ip });
  }
  for (const instansId of args.remove) {
    const res = await client.userInstanceAccess.deleteMany({ where: { userId: args.target.id, instansId } });
    if (res.count === 0) continue;
    removed.push(instansId);
    await writeAudit(client, { instansId, actorId: args.actor.id, actorLabel: args.actor.label, action: "user.access_revoke", targetId: args.target.id, targetLabel: args.target.email, detail: { via: args.source }, ip: args.actor.ip });
  }
  return { added, removed };
}

/** Slår en by op ud fra id, domæne eller by-nøgle (fx "naestved"). Entydigt eller null. */
export async function findInstanceByRef(client: Client, ref: string): Promise<{ id: string; navn: string; domaene: string } | null> {
  const target = ref.trim();
  if (!target) return null;
  const domainFromKey = domainForKey(target);
  const matches = await client.instance.findMany({
    where: { OR: [{ id: target }, { domaene: target.toLowerCase() }, ...(domainFromKey ? [{ domaene: domainFromKey }] : [])] },
    select: { id: true, navn: true, domaene: true },
  });
  return matches.length === 1 ? matches[0] : null;
}
