import { ShieldCheck } from "lucide-react";
import "@/styles/kontrolrum.css";
import { NoAccess } from "@/components/admin/no-access";
import { Badge } from "@/components/ui/Badge";
import { Notice, Stack } from "@/components/ui/Layout";
import { Page, PageHeader } from "@/components/ui/Page";
import { getAuthorizedUser } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { listSourceProfiles } from "@/lib/sources/store";
import { SourceRegistry } from "./SourceRegistry";

export default async function SourceRegistryPage() {
  const user = await getAuthorizedUser(PERMISSIONS.CONTROLROOM_MANAGE);
  if (!user) return <NoAccess area="kilderegisteret" />;
  const rows = await listSourceProfiles(user.instansId);
  return (
    <Page>
      <PageHeader
        icon={<ShieldCheck size={22} />}
        eyebrow="Kontrolrum"
        title="Kilder og rating"
        badge={<Badge tone="neutral">{rows.filter((r) => r.aktiv).length} aktive</Badge>}
        subtitle="Din egen vurdering af, hvor langt en kilde kan bære en historie. Ratingen vises på feedkort og kilder i Production Engine."
      />
      <Stack gap="lg">
      <Notice tone="info" title="Rating er et udgangspunkt, ikke en facitliste">
        En høj score betyder ikke, at et konkret udsagn er rigtigt. Tal, tidspunkter og citater kontrolleres mod originalen under Fakta i Production Engine, og redaktøren kan altid overstyre karakteren på en enkelt kilde.
      </Notice>
      <SourceRegistry rows={rows.map((r) => ({ id: r.id, navn: r.navn, type: r.type, domaene: r.domaene, score: r.score, note: r.note ?? null, aktiv: r.aktiv }))} />
      </Stack>
    </Page>
  );
}
