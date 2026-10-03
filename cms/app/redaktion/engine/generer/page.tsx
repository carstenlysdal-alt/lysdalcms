import Link from "next/link";
import { ChevronLeft, Sparkles } from "lucide-react";
import "@/styles/cms-editor.css";
import "@/styles/engine.css";
import "@/styles/generator.css";
import { NoAccess } from "@/components/admin/no-access";
import { GeneratorWorkspace } from "@/components/generator/workspace";
import { activeAiProvider } from "@/lib/ai/provider";
import { getAuthorizedUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { listSignalOptions } from "@/lib/generate/ingest";
import { PROFILE_IDS, PROFILES } from "@/lib/generate/types";
import { AI_RESTRICTED_SOURCE_TYPES } from "@/lib/ingest/schema";
import { isAiRestrictedCategoryTree, type CategoryNode } from "@/lib/marking";
import { can, PERMISSIONS } from "@/lib/permissions";
import { PAGE_PERMISSIONS } from "@/lib/redaktion-access";

const PROVIDER_LABEL = { deepseek: "DeepSeek", anthropic: "Claude" } as const;

/** Artikelgeneratoren: fra feeds og originalkilder til en komplet kladde med metadata, i ét hug. Kladden udgives aldrig automatisk. */
export default async function GeneratorPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> } = {}) {
  const user = await getAuthorizedUser([...PAGE_PERMISSIONS.engine]);
  if (!user) return <NoAccess area="artikelgeneratoren" />;
  const sp = (await searchParams) ?? {};
  const wanted = (Array.isArray(sp.signal) ? sp.signal : sp.signal ? [sp.signal] : []).map((s) => s.slice(0, 64)).slice(0, 6);

  const [signals, categories, instance] = await Promise.all([
    listSignalOptions(user, 60),
    db.category.findMany({ where: { instansId: user.instansId }, select: { id: true, navn: true, slug: true, parentId: true }, orderBy: { navn: "asc" } }),
    db.instance.findUnique({ where: { id: user.instansId }, select: { navn: true } }),
  ]);

  const byId = new Map(categories.map((c) => [c.id, c]));
  const chain = (id: string): CategoryNode => {
    const row = byId.get(id);
    const node: CategoryNode = { slug: row?.slug ?? null, navn: row?.navn ?? null, parent: null };
    let cursor = node;
    let parentId = row?.parentId ?? null;
    for (let depth = 0; parentId && depth < 10; depth++) {
      const p = byId.get(parentId);
      if (!p) break;
      const next: CategoryNode = { slug: p.slug, navn: p.navn, parent: null };
      cursor.parent = next;
      cursor = next;
      parentId = p.parentId;
    }
    return node;
  };
  const options = categories
    .filter((c) => !isAiRestrictedCategoryTree(chain(c.id)))
    .map((c) => ({ id: c.id, navn: c.parentId && byId.get(c.parentId) ? `${byId.get(c.parentId)!.navn} › ${c.navn}` : c.navn }))
    .sort((a, b) => a.navn.localeCompare(b.navn, "da"));

  const provider = activeAiProvider("editor");
  const profiles = PROFILE_IDS.map((id) => ({ id, titel: PROFILES[id].titel, beskrivelse: PROFILES[id].beskrivelse, minKilder: PROFILES[id].minKilder }));

  return (
    <main className="cms-page cms-engine-page gen-page">
      <header className="eng-ribbon">
        <div className="eng-ribbon-main">
          <p className="eng-eyebrow">Production Engine · {instance?.navn ?? "Redaktionen"}</p>
          <h1 className="eng-title">Generér artikel</h1>
        </div>
        <span className={`eng-ai-pill${provider ? "" : " is-off"}`}><Sparkles size={12} aria-hidden="true" /> {provider ? `AI: ${PROVIDER_LABEL[provider]}` : "AI ikke tilsluttet"}</span>
        <Link className="cms-btn cms-btn-secondary" href="/redaktion/engine"><ChevronLeft size={16} aria-hidden="true" /> Tilbage til Engine</Link>
      </header>
      <GeneratorWorkspace
        profiles={profiles}
        categories={options}
        signals={signals.map((s) => ({ ...s, spaerret: Boolean(s.type && (AI_RESTRICTED_SOURCE_TYPES as readonly string[]).includes(s.type)) }))}
        initialSignalIds={wanted}
        aiProvider={provider ? PROVIDER_LABEL[provider] : null}
        canUseAi={can(user, PERMISSIONS.ARTICLE_AI_USE)}
      />
    </main>
  );
}
