import { Antenna } from "lucide-react";
import "@/styles/kontrolrum.css";
import { NoAccess } from "@/components/admin/no-access";
import { Badge } from "@/components/ui/Badge";
import { Notice, Stack } from "@/components/ui/Layout";
import { Page, PageHeader } from "@/components/ui/Page";
import { getAuthorizedUser } from "@/lib/auth";
import { listFeeds } from "@/lib/feeds/store";
import { PERMISSIONS } from "@/lib/permissions";
import { FeedEditor } from "./FeedEditor";

export default async function FeedsPage() {
  const user = await getAuthorizedUser(PERMISSIONS.CONTROLROOM_MANAGE);
  if (!user) return <NoAccess area="feed-editoren" />;
  const rows = await listFeeds(user.instansId);
  return (
    <Page>
      <PageHeader
        icon={<Antenna size={22} />}
        eyebrow="Kontrolrum"
        title="Feeds"
        badge={<Badge tone="neutral">{rows.filter((r) => r.aktiv).length} aktive</Badge>}
        subtitle="Redigér, hvad indsamlingen overvåger: kilder, nøgleord og interval. Her bestemmer du hvad, ikke hvordan det hentes."
      />
      <Stack gap="lg">
      <Notice tone="info" title="Sådan bruges de">
        Feeds er konfiguration til agenterne. CMS&apos;et henter ikke selv feeds: agenten læser de aktive feeds med sin API-nøgle og leverer signaler. Maskinindsamlede signaler vises først på forsiden, når en redaktør har godkendt dem.
      </Notice>
      <FeedEditor rows={rows.map((r) => ({ id: r.id, navn: r.navn, type: r.type, url: r.url, sourceType: r.sourceType, omraadeTekst: r.omraadeTekst, inkluder: r.inkluder, ekskluder: r.ekskluder, intervalMin: r.intervalMin, aktiv: r.aktiv, noter: r.noter }))} />
      </Stack>
    </Page>
  );
}
