import { KeyRound } from "lucide-react";
import "@/styles/kontrolrum.css";
import { NoAccess } from "@/components/admin/no-access";
import { Card } from "@/components/ui/Card";
import { Notice, Stack } from "@/components/ui/Layout";
import { Page, PageHeader } from "@/components/ui/Page";
import { StatCard } from "@/components/ui/StatCard";
import { Grid } from "@/components/ui/Layout";
import { getAuthorizedUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { TYPE_DEFAULTS } from "@/lib/engine/source-rating";
import { PERMISSIONS } from "@/lib/permissions";
import { IngestKeys } from "./IngestKeys";

const fmt = new Intl.DateTimeFormat("da-DK", { timeZone: "Europe/Copenhagen", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const day = new Intl.DateTimeFormat("da-DK", { timeZone: "Europe/Copenhagen", day: "numeric", month: "short", year: "numeric" });
/** Tidspunkter beregnes uden for komponenten (rene render-funktioner). */
const dayAgo = () => new Date(Date.now() - 86_400_000);
const isLive = (k: { revokedAt: Date | null; expiresAt: Date | null }) => !k.revokedAt && (!k.expiresAt || k.expiresAt.getTime() > Date.now());
const ENDPOINTS: Array<[string, string, string]> = [
  ["POST", "/api/ingest/signals", "Lever ét eller op til 100 signaler (scope signals:write)."],
  ["GET", "/api/ingest/feeds", "Hent de aktive feed-definitioner (scope signals:write)."],
  ["POST", "/api/ingest/articles", "Lever et artikeludkast (scope articles:draft). Kræver gennemskrivning."],
  ["GET", "/api/ingest/health", "Tjek status (scope health:read)."],
];

export default async function IngestPage() {
  const user = await getAuthorizedUser(PERMISSIONS.INGEST_MANAGE);
  if (!user) return <NoAccess area="ingest" />;
  const instansId = user.instansId;
  const since = dayAgo();
  const [keys, byType, total24, last] = await Promise.all([
    db.apiKey.findMany({ where: { instansId }, orderBy: { createdAt: "desc" } }),
    db.signal.groupBy({ by: ["sourceType"], where: { instansId, maskinindsamlet: true, createdAt: { gte: since } }, _count: { _all: true } }),
    db.signal.count({ where: { instansId, maskinindsamlet: true, createdAt: { gte: since } } }),
    db.signal.findFirst({ where: { instansId, maskinindsamlet: true }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
  ]);
  const active = keys.filter(isLive).length;

  return (
    <Page>
      <PageHeader icon={<KeyRound size={22} />} eyebrow="Kontrolrum" title="Ingest" subtitle="Nøgler til agenterne, og hvad de har leveret. Alt, der kommer ind, er maskinindsamlet og ikke vurderet, før en redaktør har godkendt det." />
      <Stack gap="lg">
      <Grid cols={3}>
        <StatCard label="Aktive nøgler" value={active} hint={`${keys.length} i alt`} />
        <StatCard label="Signaler seneste døgn" value={total24} hint={last ? `Seneste ${fmt.format(last.createdAt)}` : "Intet leveret endnu"} />
        <StatCard label="Kilder seneste døgn" value={byType.length} hint={byType.length ? byType.map((b) => `${TYPE_DEFAULTS[b.sourceType ?? ""]?.label ?? "Uden type"} ${b._count._all}`).join(" · ") : "Ingen"} />
      </Grid>
      <IngestKeys rows={keys.map((k) => ({ id: k.id, name: k.name, prefix: k.prefix, scopes: Array.isArray(k.scopes) ? (k.scopes as string[]) : [], lastUsed: k.lastUsedAt ? fmt.format(k.lastUsedAt) : null, expires: k.expiresAt ? day.format(k.expiresAt) : null, revoked: Boolean(k.revokedAt), created: day.format(k.createdAt) }))} />
      <Card title="Endpoints" description="Agenten sender nøglen som Authorization: Bearer lk_…">
        <ul className="kr-endpoints">
          {ENDPOINTS.map(([method, path, text]) => <li key={path}><code className="kr-method">{method}</code> <code>{path}</code><span className="kr-muted"> — {text}</span></li>)}
        </ul>
        <Notice tone="info">Nøglen kan kun skrive til denne by. Maskinindsamlede signaler kan aldrig markeres som breaking eller notable af agenten.</Notice>
      </Card>
      </Stack>
    </Page>
  );
}
