import { Prisma } from "@prisma/client";
import { db } from "../db";
import { normalizeUrl } from "../validation/text";
import { resolveGeo } from "./geo";
import type { IngestItemResult } from "./schema";
import { signalInputSchema } from "./schema";
import type { z } from "zod";

type ParsedSignal = z.output<typeof signalInputSchema>;

/**
 * Idempotent upsert af ét signal for en given instans.
 *  1. (instansId, externalId) findes  -> opdatér hvis indholdet er ændret (version+1), ellers "duplicate"
 *  2. normaliseret kildeUrl findes    -> "duplicate" (intet overskrives; mangler rækken externalId, knyttes den)
 *  3. ellers opret.
 * Signaler er altid `maskinindsamlet`, `breaking=false`, `notable=false` — agenter kan ikke eskalere til breaking.
 * Et nyt signal er ALTID ugodkendt (godkendtAf/godkendtTid = null): det vises først offentligt efter en redaktørs godkendelse.
 * Et ændret signal (ny version) nulstilles til ulæst OG ugodkendt, så en agent ikke kan ændre teksten under en eksisterende
 * godkendelse. `meta` (skalarer) gemmes uændret og vises aldrig offentligt.
 */
export async function upsertSignal(instansId: string, ingestKeyId: string | null, input: ParsedSignal): Promise<IngestItemResult> {
  const kildeUrlNorm = normalizeUrl(input.kildeUrl);
  const brodtekst = input.braedtekst ?? input["brødtekst"] ?? null;
  const geo = await resolveGeo(instansId, input.geo);
  const kildeTidspunkt = input.publishedAt ? new Date(input.publishedAt) : null;

  const data = {
    overskrift: input.overskrift,
    brødtekst: brodtekst,
    kilde: input.kilde,
    kildeUrl: input.kildeUrl,
    sourceType: input.sourceType,
    omraadeId: geo.omraadeId,
    omraadeTekst: geo.omraadeTekst,
    kildeTidspunkt,
  };
  const meta = input.meta && Object.keys(input.meta).length > 0 ? (input.meta as Prisma.InputJsonValue) : Prisma.JsonNull;

  const byExternal = await db.signal.findUnique({ where: { instansId_externalId: { instansId, externalId: input.externalId } } });
  if (byExternal) {
    const changed =
      byExternal.overskrift !== data.overskrift ||
      (byExternal.brødtekst ?? null) !== data.brødtekst ||
      byExternal.kilde !== data.kilde ||
      byExternal.sourceType !== data.sourceType ||
      byExternal.omraadeId !== data.omraadeId ||
      (byExternal.kildeUrl ?? null) !== data.kildeUrl;
    const metaChanged = JSON.stringify(byExternal.meta ?? null) !== JSON.stringify(input.meta && Object.keys(input.meta).length > 0 ? input.meta : null);
    if (!changed && metaChanged) {
      // Kun metadata ændret: gem uden at røre ved læst-/godkendelsesstatus eller version.
      await db.signal.update({ where: { id: byExternal.id }, data: { meta, ingestKeyId } });
      return { status: "updated", id: byExternal.id, externalId: input.externalId };
    }
    if (!changed) return { status: "duplicate", id: byExternal.id, externalId: input.externalId, duplicateOf: "externalId" };
    // kildeUrlNorm opdateres kun hvis den ikke kolliderer med en anden række.
    let nextNorm = byExternal.kildeUrlNorm;
    if (kildeUrlNorm && kildeUrlNorm !== byExternal.kildeUrlNorm) {
      const clash = await db.signal.findUnique({ where: { instansId_kildeUrlNorm: { instansId, kildeUrlNorm } }, select: { id: true } });
      if (!clash) nextNorm = kildeUrlNorm;
    }
    const updated = await db.signal.update({
      where: { id: byExternal.id },
      data: { ...data, meta, kildeUrlNorm: nextNorm, version: { increment: 1 }, ingestKeyId, laest: false, godkendtAf: null, godkendtTid: null },
    });
    return { status: "updated", id: updated.id, externalId: input.externalId };
  }

  if (kildeUrlNorm) {
    const byUrl = await db.signal.findUnique({ where: { instansId_kildeUrlNorm: { instansId, kildeUrlNorm } } });
    if (byUrl) {
      if (!byUrl.externalId) await db.signal.update({ where: { id: byUrl.id }, data: { externalId: input.externalId } }).catch(() => {});
      return { status: "duplicate", id: byUrl.id, externalId: input.externalId, duplicateOf: "kildeUrl" };
    }
  }

  try {
    const created = await db.signal.create({
      data: { ...data, meta, instansId, externalId: input.externalId, kildeUrlNorm, maskinindsamlet: true, notable: false, breaking: false, ingestKeyId, godkendtAf: null, godkendtTid: null },
    });
    return { status: "created", id: created.id, externalId: input.externalId };
  } catch (error) {
    // Race: samtidig request nåede først -> behandl som duplikat.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const existing =
        (await db.signal.findUnique({ where: { instansId_externalId: { instansId, externalId: input.externalId } } })) ??
        (kildeUrlNorm ? await db.signal.findUnique({ where: { instansId_kildeUrlNorm: { instansId, kildeUrlNorm } } }) : null);
      return { status: "duplicate", id: existing?.id, externalId: input.externalId, duplicateOf: existing?.externalId === input.externalId ? "externalId" : "kildeUrl" };
    }
    throw error;
  }
}
