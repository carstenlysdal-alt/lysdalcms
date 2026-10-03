import { NextResponse } from "next/server";
import { authenticateIngest } from "@/lib/ingest/auth";
import { listFeeds } from "@/lib/feeds/store";

/**
 * GET /api/ingest/feeds   (Authorization: Bearer lk_…, scope signals:write)
 * De AKTIVE feed-definitioner, som redaktionen har oprettet i kontrolrummet for nøglens instans. Agenten bruger dem til at vide, hvad der
 * skal overvåges; den leverer fortsat signaler via POST /api/ingest/signals. Instansen bestemmes af nøglen, aldrig af forespørgslen.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await authenticateIngest(request, "signals:write");
  if (!auth.ok) return auth.response;
  const feeds = await listFeeds(auth.principal.instansId, { onlyActive: true });
  return NextResponse.json(
    {
      feeds: feeds.map((f) => ({ id: f.id, navn: f.navn, type: f.type, url: f.url, sourceType: f.sourceType, omraade: f.omraadeTekst, inkluder: f.inkluder, ekskluder: f.ekskluder, intervalMin: f.intervalMin })),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
