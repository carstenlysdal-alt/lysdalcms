import "server-only";
import type { AuthorizedUser } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { can, PERMISSIONS } from "@/lib/permissions";
import type { PromptOverrides } from "./compose";
import { getPromptDef, PROMPT_DEFS, validatePromptText, type PromptDef } from "./registry";

/**
 * Prompts som redigerbare data. Alle funktioner er instansafgrænsede. Skrivning kræver CONTROLROOM_MANAGE (slås op af
 * kalderen via getAuthorizedUser og kontrolleres her igen). Læsning til AI-flowet (`loadPromptOverrides`) kræver ingen
 * rettighed, fordi den kun leverer tekst til serverens egne kald.
 *
 * Princip: findes ingen AKTIV række for en nøgle, gælder standardteksten i koden. Historikken er uforanderlig.
 */

export type PromptRow = { id: string; aktiv: boolean; version: number; indhold: string; opdateretAf: string | null; updatedAt: Date };
export type PromptState = { def: PromptDef; row: PromptRow | null; /** Der er en aktiv tilretning i brug. */ tilpasset: boolean; /** Teksten, der gælder lige nu. */ gaeldende: string };

/** Aktive, gyldige tilretninger for en instans (til AI-flowet). Ugyldige eller forældede rækker ignoreres. */
export async function loadPromptOverrides(instansId: string): Promise<PromptOverrides> {
  const rows = await db.promptTemplate.findMany({ where: { instansId, aktiv: true }, select: { noegle: true, indhold: true } });
  const out: Record<string, string> = {};
  for (const r of rows) {
    const def = getPromptDef(r.noegle);
    if (!def) continue;
    const valid = validatePromptText(def, r.indhold);
    if (valid.ok) out[r.noegle] = valid.tekst;
  }
  return out;
}

export async function listPromptStates(instansId: string): Promise<PromptState[]> {
  const rows = await db.promptTemplate.findMany({ where: { instansId }, select: { id: true, noegle: true, aktiv: true, version: true, indhold: true, opdateretAf: true, updatedAt: true } });
  const byKey = new Map(rows.map((r) => [r.noegle, r]));
  return PROMPT_DEFS.map((def) => {
    const row = byKey.get(def.noegle) ?? null;
    const tilpasset = Boolean(row?.aktiv);
    return { def, row, tilpasset, gaeldende: tilpasset && row ? row.indhold : def.standard };
  });
}

export async function getPromptState(instansId: string, noegle: string): Promise<PromptState | null> {
  const def = getPromptDef(noegle);
  if (!def) return null;
  return (await listPromptStates(instansId)).find((s) => s.def.noegle === noegle) ?? null;
}

export type PromptRevisionView = { version: number; indhold: string; note: string | null; aendretAf: string | null; aendretAfNavn: string | null; createdAt: Date };

export async function getPromptHistory(instansId: string, noegle: string, take = 30): Promise<PromptRevisionView[]> {
  const prompt = await db.promptTemplate.findUnique({ where: { instansId_noegle: { instansId, noegle } }, select: { id: true } });
  if (!prompt) return [];
  const revisions = await db.promptRevision.findMany({ where: { promptId: prompt.id, instansId }, orderBy: { version: "desc" }, take });
  const ids = [...new Set(revisions.map((r) => r.aendretAf).filter((v): v is string => Boolean(v)))];
  const users = ids.length ? await db.user.findMany({ where: { id: { in: ids } }, select: { id: true, navn: true } }) : [];
  const names = new Map(users.map((u) => [u.id, u.navn]));
  return revisions.map((r) => ({ version: r.version, indhold: r.indhold, note: r.note, aendretAf: r.aendretAf, aendretAfNavn: r.aendretAf ? (names.get(r.aendretAf) ?? null) : null, createdAt: r.createdAt }));
}

export type PromptResult = { ok: true; version: number; besked: string } | { ok: false; error: string; konflikt?: boolean };

const NOTE_MAX = 200;
const cleanNote = (note: string | null | undefined) => (note ?? "").replace(/\s+/g, " ").trim().slice(0, NOTE_MAX) || null;

type Mode = { kind: "save"; indhold: string } | { kind: "reset" } | { kind: "restore"; version: number };

async function write(user: AuthorizedUser, noegle: string, mode: Mode, opts: { note?: string | null; baseVersion?: number | null }): Promise<PromptResult> {
  if (!can(user, PERMISSIONS.CONTROLROOM_MANAGE)) return { ok: false, error: "Du har ikke adgang til at ændre prompts." };
  const def = getPromptDef(noegle);
  if (!def) return { ok: false, error: "Ukendt prompt." };

  const instansId = user.instansId;
  return db.$transaction(async (tx): Promise<PromptResult> => {
    const existing = await tx.promptTemplate.findUnique({ where: { instansId_noegle: { instansId, noegle } } });
    if (opts.baseVersion != null && (existing?.version ?? 0) !== opts.baseVersion) {
      return { ok: false, konflikt: true, error: `Prompten er ændret af en anden (nu version ${existing?.version ?? 0}). Genindlæs siden, og tjek ændringen, før du gemmer igen.` };
    }

    let indhold: string;
    let aktiv = true;
    let note = cleanNote(opts.note);
    let action: "prompt.save" | "prompt.reset" | "prompt.restore" = "prompt.save";

    if (mode.kind === "reset") {
      if (!existing?.aktiv) return { ok: false, error: "Prompten bruger allerede standardteksten." };
      indhold = def.standard;
      aktiv = false;
      note = note ?? "Nulstillet til standard";
      action = "prompt.reset";
    } else if (mode.kind === "restore") {
      if (!existing) return { ok: false, error: "Der er ingen historik at gendanne fra." };
      const revision = await tx.promptRevision.findUnique({ where: { promptId_version: { promptId: existing.id, version: mode.version } } });
      if (!revision) return { ok: false, error: "Versionen findes ikke." };
      const valid = validatePromptText(def, revision.indhold);
      if (!valid.ok) return { ok: false, error: `Versionen kan ikke gendannes: ${valid.error}` };
      indhold = valid.tekst;
      note = note ?? `Gendannet fra version ${mode.version}`;
      action = "prompt.restore";
    } else {
      const valid = validatePromptText(def, mode.indhold);
      if (!valid.ok) return { ok: false, error: valid.error };
      indhold = valid.tekst;
      if (indhold === def.standard.trim()) {
        // Svarer til standarden: der er ingen tilretning at gemme. Ligger der en aktiv, afsluttes den som nulstilling.
        if (!existing?.aktiv) return { ok: false, error: "Teksten er identisk med standarden. Der er ikke noget at gemme." };
        aktiv = false;
        note = note ?? "Svarer til standard";
        action = "prompt.reset";
      }
    }

    const version = (existing?.version ?? 0) + 1;
    const row = existing
      ? await tx.promptTemplate.update({ where: { id: existing.id }, data: { indhold, aktiv, version, opdateretAf: user.id } })
      : await tx.promptTemplate.create({ data: { instansId, noegle, indhold, aktiv, version, opdateretAf: user.id } });
    await tx.promptRevision.create({ data: { promptId: row.id, instansId, version, indhold, note, aendretAf: user.id } });
    // Aldrig promptens indhold i auditloggen: kun nøgle og version.
    await writeAudit(tx, { instansId, actorId: user.id, actorLabel: user.name, action, targetId: row.id, targetLabel: def.titel, detail: { noegle, version, aktiv } });
    return { ok: true, version, besked: aktiv ? `Gemt som version ${version}.` : `Nulstillet til standard (version ${version}).` };
  });
}

export const savePrompt = (user: AuthorizedUser, noegle: string, indhold: string, opts: { note?: string | null; baseVersion?: number | null } = {}) => write(user, noegle, { kind: "save", indhold }, opts);
export const resetPrompt = (user: AuthorizedUser, noegle: string, opts: { baseVersion?: number | null } = {}) => write(user, noegle, { kind: "reset" }, opts);
export const restorePrompt = (user: AuthorizedUser, noegle: string, version: number, opts: { baseVersion?: number | null } = {}) => write(user, noegle, { kind: "restore", version }, opts);
