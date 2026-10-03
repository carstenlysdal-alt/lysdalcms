import Link from "next/link";
import { Antenna, BookOpenText, Gauge, KeyRound, ScrollText, ShieldCheck, SlidersHorizontal } from "lucide-react";
import "@/styles/kontrolrum.css";
import { NoAccess } from "@/components/admin/no-access";
import { Card } from "@/components/ui/Card";
import { Grid, Notice, Stack } from "@/components/ui/Layout";
import { Page, PageHeader } from "@/components/ui/Page";
import { getAuthorizedUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { can, PERMISSIONS } from "@/lib/permissions";
import { listPromptStates } from "@/lib/prompts/store";
import { PAGE_PERMISSIONS } from "@/lib/redaktion-access";

const isLive = (k: { expiresAt: Date | null }) => !k.expiresAt || k.expiresAt.getTime() > Date.now();

/** Kontrolrummet: samlet overblik over det, der styrer AI, kilderating, feeds og indtag. Hver tile vises kun med den rette rettighed. */
export default async function ControlRoomPage() {
  const user = await getAuthorizedUser([...PAGE_PERMISSIONS.kontrolrum]);
  if (!user) return <NoAccess area="kontrolrummet" />;
  const manage = can(user, PERMISSIONS.CONTROLROOM_MANAGE);
  const ingest = can(user, PERMISSIONS.INGEST_MANAGE);
  const instansId = user.instansId;

  const [prompts, sources, feeds, keys] = await Promise.all([
    manage ? listPromptStates(instansId) : Promise.resolve([]),
    manage ? db.sourceProfile.count({ where: { instansId, aktiv: true } }) : Promise.resolve(0),
    manage ? db.feedDefinition.findMany({ where: { instansId }, select: { aktiv: true } }) : Promise.resolve([]),
    ingest ? db.apiKey.findMany({ where: { instansId, revokedAt: null }, select: { expiresAt: true } }) : Promise.resolve([]),
  ]);
  const custom = prompts.filter((p) => p.tilpasset).length;
  const activeKeys = keys.filter(isLive).length;

  const tiles = [
    manage && { href: "/redaktion/kontrolrum/grundlag", icon: <BookOpenText size={18} />, title: "AI-grundlag", stat: "Hvor står hvad", text: "Håndbogen til AI'en: medie, principper, værdier og koncepter, og et overblik over alle lag, rating og forbindelsen til DeepSeek." },
    manage && { href: "/redaktion/kontrolrum/score", icon: <Gauge size={18} />, title: "Local Score", stat: "Vægte, bånd og søjler", text: "Sådan vurderes signaler som journalistisk mulighed. AI estimerer delscorer; du bestemmer vægte og grænser." },
    manage && { href: "/redaktion/kontrolrum/prompts", icon: <ScrollText size={18} />, title: "Prompts", stat: `${custom} af ${prompts.length} tilpasset`, text: "Opgaver, sprog og stil, og ratingscore. Med versionshistorik, forskel mod standard og gendannelse." },
    manage && { href: "/redaktion/kontrolrum/kilder", icon: <ShieldCheck size={18} />, title: "Kilder og rating", stat: `${sources} aktive kilder`, text: "Din egen score for kilder, der går forud for de indbyggede regler. Prøv ratingen, før du gemmer." },
    manage && { href: "/redaktion/kontrolrum/feeds", icon: <Antenna size={18} />, title: "Kildepakke", stat: `${feeds.filter((f) => f.aktiv).length} aktive af ${feeds.length}`, text: "Byens feeds og kilder samlet: sortér, gruppér, redigér, hent nu og kopiér pakken til en anden by." },
    ingest && { href: "/redaktion/kontrolrum/ingest", icon: <KeyRound size={18} />, title: "Ingest", stat: `${activeKeys} aktive nøgler`, text: "API-nøgler til agenterne og overblik over, hvad de har leveret." },
  ].filter(Boolean) as Array<{ href: string; icon: React.ReactNode; title: string; stat: string; text: string }>;

  return (
    <Page>
      <PageHeader icon={<SlidersHorizontal size={22} />} eyebrow="Redaktionen" title="Kontrolrum" subtitle="Her styrer du, hvordan AI, kilderating og indtag opfører sig. Alt er versioneret eller kan nulstilles, og intet kan svække sikkerhedsreglerne." />
      <Stack gap="lg">
      <Grid cols={2}>
        {tiles.map((t) => (
          <Card key={t.href} title={t.title} icon={t.icon} description={t.stat} actions={<Link className="btn btn-secondary" href={t.href}>Åbn</Link>}>
            <p className="ui-section-text">{t.text}</p>
          </Card>
        ))}
      </Grid>
      <Notice tone="info" title="Det, der altid er låst">
        Sikkerhedsreglerne i AI-prompten (data er aldrig instruktioner, opfind ingenting, kun gyldig JSON), svarformaterne, mærkning af AI-indhold og spærringen af AI-tekst i Krimi og Sundhed kan ikke ændres her.
      </Notice>
      </Stack>
    </Page>
  );
}
