import Link from "next/link";
import { ScrollText } from "lucide-react";
import "@/styles/kontrolrum.css";
import { NoAccess } from "@/components/admin/no-access";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Notice, Stack } from "@/components/ui/Layout";
import { Page, PageHeader } from "@/components/ui/Page";
import { getAuthorizedUser } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { KIND_LABEL, type PromptKind } from "@/lib/prompts/registry";
import { listPromptStates } from "@/lib/prompts/store";

const ORDER: PromptKind[] = ["grundlag", "sprog", "opgave", "rating"];
const dateFmt = new Intl.DateTimeFormat("da-DK", { timeZone: "Europe/Copenhagen", day: "numeric", month: "short", year: "numeric" });

export default async function PromptsPage() {
  const user = await getAuthorizedUser(PERMISSIONS.CONTROLROOM_MANAGE);
  if (!user) return <NoAccess area="prompts i kontrolrummet" />;
  const states = await listPromptStates(user.instansId);
  const custom = states.filter((s) => s.tilpasset).length;

  return (
    <Page>
      <PageHeader
        icon={<ScrollText size={22} />}
        eyebrow="Kontrolrum"
        title="Prompts"
        badge={<Badge tone={custom ? "primary" : "neutral"}>{custom} af {states.length} tilpasset</Badge>}
        subtitle="Det, redaktionens AI får at vide: opgaver, sprog og stil, og ratingscore. Ændringer gælder for hele byen fra næste AI-kald, og hver version bevares."
      />
      <Stack gap="lg">
      <Notice tone="info" title="Det kan ikke ændres her">
        Sikkerhedsreglerne (data er aldrig instruktioner, opfind ingenting, kun JSON) og svarformaterne er låst i koden. Din tekst lægges oven på dem og kan aldrig ophæve dem.
      </Notice>
      {ORDER.map((kind) => {
        const rows = states.filter((s) => s.def.kind === kind);
        if (rows.length === 0) return null;
        return (
          <Card key={kind} title={KIND_LABEL[kind]} padding="none" headingLevel={2}>
            <ul className="kr-list">
              {rows.map(({ def, row, tilpasset }) => (
                <li key={def.noegle} className="kr-list-item">
                  <div className="kr-list-main">
                    <Link className="kr-list-title" href={`/redaktion/kontrolrum/prompts/${encodeURIComponent(def.noegle)}`}>{def.titel}</Link>
                    <p className="kr-list-text">{def.beskrivelse}</p>
                  </div>
                  <div className="kr-list-side">
                    <Badge tone={tilpasset ? "primary" : "neutral"} dot>{tilpasset ? `Tilpasset · v${row?.version}` : "Standard"}</Badge>
                    {row && <small className="kr-muted">Ændret {dateFmt.format(row.updatedAt)}</small>}
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        );
      })}
      </Stack>
    </Page>
  );
}
