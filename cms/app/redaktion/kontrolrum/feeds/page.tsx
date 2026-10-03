import { Antenna } from "lucide-react";
import "@/styles/kontrolrum.css";
import "@/styles/kildepakke.css";
import { NoAccess } from "@/components/admin/no-access";
import { Badge } from "@/components/ui/Badge";
import { Notice, Stack } from "@/components/ui/Layout";
import { Page, PageHeader } from "@/components/ui/Page";
import { getAuthorizedUser } from "@/lib/auth";
import { CATALOG_PACKS } from "@/lib/feeds/catalog";
import { listFeeds } from "@/lib/feeds/store";
import { db } from "@/lib/db";
import { listOtherCities } from "@/lib/instance-access";
import { PERMISSIONS } from "@/lib/permissions";
import type { FeedItemRow } from "./feed-types";
import { PackBoard } from "./PackBoard";

const when = new Intl.DateTimeFormat("da-DK", { timeZone: "Europe/Copenhagen", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export default async function FeedsPage() {
  const user = await getAuthorizedUser(PERMISSIONS.CONTROLROOM_MANAGE);
  if (!user) return <NoAccess area="kildepakken" />;
  const [rows, instance, others] = await Promise.all([
    listFeeds(user.instansId),
    db.instance.findUnique({ where: { id: user.instansId }, select: { navn: true } }),
    listOtherCities(user),
  ]);
  const cityName = instance?.navn ?? "byen";
  const items: FeedItemRow[] = rows.map((r) => ({
    id: r.id, navn: r.navn, type: r.type, url: r.url, sourceType: r.sourceType, omraadeTekst: r.omraadeTekst, inkluder: r.inkluder, ekskluder: r.ekskluder,
    intervalMin: r.intervalMin, aktiv: r.aktiv, noter: r.noter, kategori: r.kategori, prioritet: r.prioritet,
    hentetLabel: r.sidstHentet ? when.format(r.sidstHentet) : null, sidsteStatus: r.sidsteStatus, sidsteAntal: r.sidsteAntal, sidsteBesked: r.sidsteBesked,
  }));
  return (
    <Page width="wide">
      <PageHeader
        icon={<Antenna size={22} />}
        eyebrow={`Kontrolrum · ${cityName}`}
        title="Kildepakke"
        badge={<Badge tone="neutral">{rows.filter((r) => r.aktiv).length} aktive</Badge>}
        subtitle={`Alle kilder, feeds og overvågning for ${cityName} samlet ét sted. Sortér, gruppér og redigér hele pakken, hent kilder med det samme, eller kopiér pakken til en anden by.`}
      />
      <Stack gap="lg">
        <Notice tone="info" title="Sådan hænger det sammen">
          Hver by har sin egen pakke. En kilde bliver først hentet, når en redaktør trykker på Hent nu. Det, der hentes, lander som ugodkendte signaler i Production Engine og vises først offentligt efter godkendelse. Agenter bruger de aktive feeds via API&apos;et.
        </Notice>
        <PackBoard rows={items} cityName={cityName} cities={others.map((c) => ({ id: c.id, navn: c.navn }))} catalogs={CATALOG_PACKS.map((p) => ({ id: p.id, navn: p.navn, antal: p.rows.length }))} />
      </Stack>
    </Page>
  );
}
