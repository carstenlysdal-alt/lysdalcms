import Link from "next/link";
import { Plus, Sparkles } from "lucide-react";
import "@/styles/cms-editor.css";
import "@/styles/engine.css";
import { NoAccess } from "@/components/admin/no-access";
import { ArticleCorrections } from "@/components/editor/article-corrections";
import { ArticleEditor } from "@/components/editor/article-editor";
import { EngineCopilot } from "@/components/engine/copilot";
import { engineHref, FeedPane, type EngineQuery } from "@/components/engine/feed-pane";
import { EngineWorkspace } from "@/components/engine/workspace";
import { activeAiProvider } from "@/lib/ai/provider";
import { getAuthorizedUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { emptyArticleValue, loadArticleValue, loadEditorOptions } from "@/lib/editor/load";
import { loadFeed, timeLabel } from "@/lib/engine/feed";
import { ENGINE_TABS, type EngineTab } from "@/lib/engine/types";
import { can, canEditArticle, PERMISSIONS } from "@/lib/permissions";
import { PAGE_PERMISSIONS } from "@/lib/redaktion-access";
import { loadActiveSourceProfiles } from "@/lib/sources/store";

const PROVIDER_LABEL = { deepseek: "DeepSeek", anthropic: "Claude" } as const;
type Params = Record<string, string | string[] | undefined>;

/**
 * Production Engine: signaler ind (venstre), skrivefladen (midten) og copilot med kvalitetstjek, faktatjek mod originalkilder
 * og kilderating (højre). Samler det eksisterende (signaler, indbakke, editor, AI, SEO) uden at ændre deres regler.
 */
export default async function EnginePage({ searchParams }: { searchParams?: Promise<Params> } = {}) {
  const user = await getAuthorizedUser([...PAGE_PERMISSIONS.engine]);
  if (!user) return <NoAccess area="Production Engine" />;

  const sp = (await searchParams) ?? {};
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string).slice(0, 200) : "");
  const tab: EngineTab = (ENGINE_TABS as readonly string[]).includes(str("tab")) ? (str("tab") as EngineTab) : "feeds";
  const query: EngineQuery = { tab, omraade: str("omraade"), q: str("q"), id: str("id") };
  const isNew = str("ny") === "1" && !query.id;

  const wantsEditor = Boolean(query.id) || isNew;
  const [feed, instance, profiles, editorData, selected] = await Promise.all([
    loadFeed(user, { tab, omraade: query.omraade, query: query.q, articleId: query.id || null }),
    db.instance.findUnique({ where: { id: user.instansId }, select: { navn: true } }),
    loadActiveSourceProfiles(user.instansId),
    wantsEditor ? loadEditorOptions(user) : Promise.resolve(null),
    query.id ? loadArticleValue(user, query.id) : Promise.resolve(null),
  ]);

  const provider = activeAiProvider("editor");
  const aiProvider = provider ? PROVIDER_LABEL[provider] : null;
  const canWrite = can(user, PERMISSIONS.ARTICLE_CREATE);
  const canResearch = can(user, PERMISSIONS.ARTICLE_CREATE);
  const idle = { canResearch, aiProvider };
  const closeHref = engineHref(query, { id: "" });

  let center: React.ReactNode;
  if (editorData && isNew) {
    center = (
      <ArticleEditor key="ny" article={emptyArticleValue(user)} options={editorData.options} flags={editorData.flags} site={editorData.site} transitions={[]} mode="engine" engine={{ profiles, aiProvider }} closeHref={closeHref} hasUnverifiedSource={false} />
    );
  } else if (editorData && selected && canEditArticle(user, selected.row)) {
    const corrections = await db.correction.findMany({ where: { articleId: selected.row.id, instansId: user.instansId, fjernetTid: null }, orderBy: { dato: "desc" } });
    center = (
      <ArticleEditor
        key={selected.row.id}
        article={selected.value}
        options={editorData.options}
        flags={editorData.flags}
        site={editorData.site}
        transitions={selected.transitions}
        mode="engine"
        engine={{ profiles, aiProvider }}
        closeHref={closeHref}
        hasUnverifiedSource={typeof (selected.row.marking as { uverificeretKilde?: unknown } | null)?.uverificeretKilde === "boolean"}
      >
        <ArticleCorrections articleId={selected.row.id} corrections={corrections} canRemove={can(user, PERMISSIONS.ARTICLE_PUBLISH) || can(user, PERMISSIONS.ARTICLE_EDIT_ALL)} />
      </ArticleEditor>
    );
  } else {
    const message = selected
      ? { title: "Ingen redigeringsadgang", text: "Du kan kun redigere dine egne artikler." }
      : query.id
        ? { title: "Historien findes ikke", text: "Den er slettet, eller hører til en anden by." }
        : { title: "Vælg et signal eller en historie", text: "Start en historie fra et signal i feedet til venstre, eller opret en tom historie." };
    center = (
      <>
        <div className="cms-ed-main eng-center">
          <section className="eng-card eng-empty">
            <h2 className="eng-card-title">{message.title}</h2>
            <p className="cms-hint">{message.text}</p>
            {canWrite && <Link className="cms-btn cms-btn-primary" href="/redaktion/engine?ny=1"><Plus size={16} aria-hidden="true" /> Ny historie</Link>}
          </section>
        </div>
        <aside className="eng-copilot" aria-label="Copilot"><EngineCopilot ctx={null} idle={idle} /></aside>
      </>
    );
  }

  const sync = feed.sync.sidsteMaskinSignalIso ? `Seneste signal ${timeLabel(new Date(feed.sync.sidsteMaskinSignalIso))}` : "Ingen agent har leveret signaler endnu";
  return (
    <main className="cms-page cms-engine-page">
      <header className="eng-ribbon">
        <div className="eng-ribbon-main">
          <p className="eng-eyebrow">Production Engine</p>
          <h1 className="eng-title">{instance?.navn ?? "Redaktionen"}</h1>
        </div>
        <ul className="eng-ribbon-status" aria-label="Status">
          <li><span className={`eng-live${feed.sync.maskin24t > 0 ? " is-live" : ""}`}><span className="eng-live-dot" aria-hidden="true" />{feed.sync.maskin24t} maskinsignaler seneste døgn</span></li>
          <li className="cms-muted">{sync}</li>
          <li><span className={`eng-ai-pill${aiProvider ? "" : " is-off"}`}><Sparkles size={12} aria-hidden="true" /> {aiProvider ? `AI: ${aiProvider}` : "AI ikke tilsluttet"}</span></li>
        </ul>
        {canWrite && <Link className="cms-btn cms-btn-primary" href="/redaktion/engine?ny=1"><Plus size={16} aria-hidden="true" /> Ny historie</Link>}
      </header>
      <EngineWorkspace initialPane={wantsEditor ? "edit" : "feed"} feed={<FeedPane data={feed} query={query} canWrite={canWrite} />}>
        {center}
      </EngineWorkspace>
    </main>
  );
}
