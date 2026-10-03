import Link from "next/link";
import { Gauge } from "lucide-react";
import "@/styles/kontrolrum.css";
import "@/styles/score-editor.css";
import { NoAccess } from "@/components/admin/no-access";
import { Badge } from "@/components/ui/Badge";
import { Page, PageHeader } from "@/components/ui/Page";
import { getAuthorizedUser } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { SCORE_CONFIG_KEY, SCORE_PROMPT_KEY } from "@/lib/prompts/compose";
import { getPromptState } from "@/lib/prompts/store";
import { configFromOverrides } from "@/lib/score/service";
import { ScoreEditor } from "./ScoreEditor";

/** Local Score (Y Rating): vægte, bånd, funktioner og søjler som redigerbar data. AI estimerer delscorer; systemet beregner totalen. */
export default async function ScorePage() {
  const user = await getAuthorizedUser(PERMISSIONS.CONTROLROOM_MANAGE);
  if (!user) return <NoAccess area="Local Score" />;
  const [conf, prompt] = await Promise.all([getPromptState(user.instansId, SCORE_CONFIG_KEY), getPromptState(user.instansId, SCORE_PROMPT_KEY)]);
  const config = configFromOverrides(conf?.tilpasset && conf.row ? { [SCORE_CONFIG_KEY]: conf.row.indhold } : {});
  return (
    <Page width="wide">
      <PageHeader
        icon={<Gauge size={22} />}
        eyebrow="Kontrolrum"
        title="Local Score"
        badge={<Badge tone={conf?.tilpasset ? "primary" : "neutral"}>{conf?.tilpasset ? `Tilpasset · v${conf.row?.version}` : "Standard"}</Badge>}
        subtitle="Sådan vurderes et signal som journalistisk mulighed. AI estimerer kun delscorerne. Totalen, båndet og søjlerne beregnes af systemet ud fra de vægte og grænser, du bestemmer her, og en ændring slår igennem på alle eksisterende vurderinger uden nyt AI-kald."
      />
      <ScoreEditor config={config} version={conf?.row?.version ?? 0} tilpasset={Boolean(conf?.tilpasset)} />
      <p className="kr-muted" style={{ marginTop: 16 }}>
        Instruktionen til AI (hvordan delscorerne estimeres) redigeres som prompt: <Link href={`/redaktion/kontrolrum/prompts/${SCORE_PROMPT_KEY}`}>Local Score: vurdering af signaler</Link>{prompt?.tilpasset ? " (tilpasset)" : ""}. Historik og gendannelse af vægtene: <Link href={`/redaktion/kontrolrum/prompts/${SCORE_CONFIG_KEY}`}>versionshistorik</Link>.
      </p>
    </Page>
  );
}
