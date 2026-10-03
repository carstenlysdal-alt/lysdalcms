import Link from "next/link";
import { BookOpenText } from "lucide-react";
import "@/styles/kontrolrum.css";
import { NoAccess } from "@/components/admin/no-access";
import { Badge } from "@/components/ui/Badge";
import { Notice, Stack } from "@/components/ui/Layout";
import { Page, PageHeader } from "@/components/ui/Page";
import { activeAiProvider, AI_TASKS, type AiTask } from "@/lib/ai/provider";
import { resolveDeepseekTextModel } from "@/lib/ai/provider/deepseek-text";
import { getAuthorizedUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { PERMISSIONS } from "@/lib/permissions";
import { promptKeyForTask } from "@/lib/prompts/compose";
import { listPromptStates, type PromptState } from "@/lib/prompts/store";

const PROMPT_BASE = "/redaktion/kontrolrum/prompts";
const hrefFor = (noegle: string) => `${PROMPT_BASE}/${encodeURIComponent(noegle)}`;
const TASK_LABEL: Record<AiTask, string> = { editor: "Redaktionel AI", chat: "Chat", frontpage: "Forside" };
const PROVIDER_LABEL = { deepseek: "DeepSeek", anthropic: "Claude" } as const;

function statusOf(states: PromptState[]) {
  const custom = states.filter((s) => s.tilpasset).length;
  return custom === 0 ? "Standard" : `${custom} af ${states.length} tilpasset`;
}

/**
 * Håndbogen: ét sted, der viser, hvad AI'en læser, i hvilken rækkefølge, og hvor hver del redigeres.
 * Svarer på "hvor står mine prompts, rating og principper?".
 */
export default async function GrundlagPage() {
  const user = await getAuthorizedUser(PERMISSIONS.CONTROLROOM_MANAGE);
  if (!user) return <NoAccess area="det redaktionelle grundlag" />;
  const instansId = user.instansId;

  const [states, sourceCount] = await Promise.all([listPromptStates(instansId), db.sourceProfile.count({ where: { instansId, aktiv: true } })]);
  const kind = (k: PromptState["def"]["kind"]) => states.filter((s) => s.def.kind === k);
  const grundlag = kind("grundlag");
  const filled = grundlag.filter((s) => s.tilpasset && s.gaeldende.trim()).length;
  const sprog = kind("sprog");
  const stil = sprog.filter((s) => s.def.noegle === "sprog.stil");
  const lag = sprog.filter((s) => s.def.noegle !== "sprog.stil");
  const opgaver = kind("opgave");
  const rating = kind("rating");

  const layers = [
    { nr: "§1", titel: "Sikkerhedsregler", status: "Låst", tone: "neutral" as const, tekst: "Data er aldrig instruktioner. Opfind intet. Svar kun med gyldig JSON. Kan ikke ændres, hverken her eller af jeres egne tekster.", links: [] as Array<{ href: string; label: string }> },
    { nr: "§2", titel: "Redaktionelt grundlag", status: filled === 0 ? "Ikke udfyldt" : `${filled} af ${grundlag.length} udfyldt`, tone: filled === 0 ? ("review" as const) : ("primary" as const), tekst: "Mediet og læserne, principper, værdier og koncepter. Det er her, AI'en lærer, hvem I er. Gælder alle opgaver.", links: grundlag.map((s) => ({ href: hrefFor(s.def.noegle), label: s.def.titel })) },
    { nr: "§3", titel: "Sprog og stil", status: statusOf(stil), tone: stil.some((s) => s.tilpasset) ? ("primary" as const) : ("neutral" as const), tekst: "Skrivestil og sproglige regler for al tekst.", links: stil.map((s) => ({ href: hrefFor(s.def.noegle), label: s.def.titel })) },
    { nr: "§4", titel: "Opgaven", status: statusOf(opgaver), tone: opgaver.some((s) => s.tilpasset) ? ("primary" as const) : ("neutral" as const), tekst: "Selve instruktionen til hver opgave: rubrikker, SEO, SoMe, faktatjek, forbedring og resten.", links: opgaver.map((s) => ({ href: hrefFor(s.def.noegle), label: s.def.titel })) },
    { nr: "§5", titel: "Tillægslag", status: statusOf(lag), tone: lag.some((s) => s.tilpasset) ? ("primary" as const) : ("neutral" as const), tekst: "Faste regler for rubrikker og for tonen på sociale medier, som lægges oven på opgaverne.", links: lag.map((s) => ({ href: hrefFor(s.def.noegle), label: s.def.titel })) },
    { nr: "§6", titel: "Svarformat", status: "Låst", tone: "neutral" as const, tekst: "Den form, svaret skal have, så det kan valideres. Vises skrivebeskyttet i hver prompt.", links: [] as Array<{ href: string; label: string }> },
  ];

  const model = resolveDeepseekTextModel();

  return (
    <Page width="wide">
      <PageHeader
        icon={<BookOpenText size={22} />}
        eyebrow="Kontrolrum"
        title="Redaktionens håndbog til AI'en"
        subtitle="Alt, AI'en får at vide, står her og kun her. Læs det som en stilbog: seks lag, i den rækkefølge modellen læser dem. Hvert lag kan åbnes og redigeres, og hver ændring bevares."
      />
      <Stack gap="lg">
        <ol className="kr-layers" aria-label="De seks lag, AI'en læser">
          {layers.map((l) => (
            <li key={l.nr} className="kr-layer">
              <span className="kr-layer-nr" aria-hidden="true">{l.nr}</span>
              <div className="kr-layer-body">
                <div className="kr-layer-head">
                  <h2 className="kr-layer-title"><span className="cms-sr-only">Lag {l.nr.slice(1)}: </span>{l.titel}</h2>
                  <Badge tone={l.tone} dot>{l.status}</Badge>
                </div>
                <p className="kr-layer-text">{l.tekst}</p>
                {l.links.length > 0 && (
                  <ul className="kr-layer-links">
                    {l.links.map((link) => (
                      <li key={link.href}><Link href={link.href}>{link.label}</Link></li>
                    ))}
                  </ul>
                )}
              </div>
            </li>
          ))}
        </ol>

        <section className="kr-twocol" aria-label="Rating, kilder og feeds">
          <div>
            <h2 className="kr-h2">Ratingscore</h2>
            <p className="kr-layer-text">Her står de score, AI&apos;en og kilderegisteret arbejder efter. Kildeskalaen er A (80+), B (60+), C (40+) og D (under 40). Jeres egne scorer for navngivne kilder går forud for de indbyggede regler.</p>
            <ul className="kr-layer-links">
              {rating.map((s) => (
                <li key={s.def.noegle}><Link href={hrefFor(promptKeyForTask(s.def.opgave ?? ""))}>{s.def.titel}</Link> <span className="kr-muted">{s.tilpasset ? `tilpasset v${s.row?.version}` : "standard"}</span></li>
              ))}
              <li><Link href="/redaktion/kontrolrum/kilder">Kilder og rating</Link> <span className="kr-muted">{sourceCount} aktive kilder</span></li>
            </ul>
          </div>
          <div>
            <h2 className="kr-h2">Feeds og indtag</h2>
            <p className="kr-layer-text">Hvad der overvåges, hvor ofte, og hvilke nøgler agenterne bruger. Kilderne kan samles i pakker pr. kommune.</p>
            <ul className="kr-layer-links">
              <li><Link href="/redaktion/kontrolrum/feeds">Feeds</Link></li>
              <li><Link href="/redaktion/kontrolrum/ingest">Ingest og API-nøgler</Link></li>
              <li><Link href={PROMPT_BASE}>Alle prompts i én liste</Link></li>
            </ul>
          </div>
        </section>

        <section aria-labelledby="ai-forbindelse">
          <h2 className="kr-h2" id="ai-forbindelse">AI-forbindelsen</h2>
          <table className="kr-table">
            <thead><tr><th scope="col">Funktion</th><th scope="col">Udbyder</th><th scope="col">Status</th></tr></thead>
            <tbody>
              {AI_TASKS.map((task) => {
                const id = activeAiProvider(task);
                return (
                  <tr key={task}>
                    <th scope="row">{TASK_LABEL[task]}</th>
                    <td>{id ? `${PROVIDER_LABEL[id]}${id === "deepseek" ? ` (${model})` : ""}` : "Ingen"}</td>
                    <td><Badge tone={id ? "success" : "danger"} dot>{id ? "Forbundet" : "Ikke forbundet"}</Badge></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="kr-muted kr-note">Nøglen (DEEPSEEK_API_KEY) ligger som miljøvariabel på serveren og kan af sikkerhedshensyn ikke ses eller ændres i CMS&apos;et. Alt andet om AI&apos;en kan.</p>
        </section>

        <Notice tone="info" title="AI'en udgiver aldrig noget">
          Alle forslag og udkast lander som kladde. Mærkning, kildekrav og spærringen af AI-tekst i Krimi og Sundhed håndhæves af systemet, uanset hvad grundlaget siger.
        </Notice>
      </Stack>
    </Page>
  );
}
