/** Server-side indlæsning af alt editoren skal bruge (tenant-afgrænset). Bruges af listesiden, /[id] og /ny. */
import { db } from "@/lib/db";
import type { AuthorizedUser } from "@/lib/auth";
import { parseBlocks } from "@/lib/blocks/schema";
import { isAiRestrictedCategoryTree, type CategoryNode, type Marking } from "@/lib/marking";
import { can, PERMISSIONS } from "@/lib/permissions";
import { availableTransitions } from "@/lib/workflow";
import { metaFromRow, serializeMeta } from "@/lib/article-meta";
import { siteBase } from "@/lib/seo/url";
import type { ArticleEditorValue, EditorFlags, EditorOptions, EditorSite } from "./types";

function toneOf(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return (h % 6) + 1;
}

export async function loadEditorOptions(user: AuthorizedUser): Promise<{ options: EditorOptions; flags: EditorFlags; site: EditorSite }> {
  const instansId = user.instansId;
  const [categories, authors, tags, geoTags, media, instance] = await Promise.all([
    db.category.findMany({ where: { instansId }, select: { id: true, navn: true, slug: true, parentId: true }, orderBy: [{ parentId: "asc" }, { sortering: "asc" }, { navn: "asc" }] }),
    db.author.findMany({ where: { instansId }, orderBy: { navn: "asc" }, select: { id: true, navn: true } }),
    db.tag.findMany({ where: { instansId }, orderBy: { navn: "asc" }, select: { id: true, navn: true } }),
    db.geoTag.findMany({ where: { instansId }, orderBy: { navn: "asc" }, select: { id: true, navn: true } }),
    db.media.findMany({
      where: { instansId, filtype: "billede" },
      orderBy: { createdAt: "desc" },
      take: 300,
      select: { id: true, url: true, altTekst: true, billedtekst: true, filnavn: true, ophavsperson: true, bredde: true, hoejde: true },
    }),
    db.instance.findUnique({ where: { id: instansId }, select: { domaene: true, navn: true } }),
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

  const formatted = categories
    .map((c) => {
      const parent = c.parentId ? byId.get(c.parentId) : null;
      return { id: c.id, navn: parent ? `${parent.navn} › ${c.navn}` : c.navn, tone: toneOf(parent?.id ?? c.id), sektionSlug: parent?.slug ?? c.slug };
    })
    .sort((a, b) => a.navn.localeCompare(b.navn, "da"));
  const restrictedCategoryIds = categories.filter((c) => isAiRestrictedCategoryTree(chain(c.id))).map((c) => c.id);

  return {
    options: { categories: formatted, authors, tags, geoTags, media },
    flags: {
      canResearch: can(user, PERMISSIONS.ARTICLE_CREATE),
      canPublish: can(user, PERMISSIONS.ARTICLE_PUBLISH),
      canControlFrontpage: can(user, PERMISSIONS.FRONTPAGE_EDIT),
      canUseAi: can(user, PERMISSIONS.ARTICLE_AI_USE),
      restrictedCategoryIds,
    },
    site: { domaene: instance?.domaene ?? "", navn: instance?.navn ?? "", base: instance ? siteBase({ domaene: instance.domaene }) : "" },
  };
}

export function emptyArticleValue(user: AuthorizedUser): ArticleEditorValue {
  return {
    id: null, titel: "", manchet: "", slug: "", blocks: [{ id: "initial-paragraph", type: "paragraph", data: { content: "" } }],
    status: "Idé", indholdstype: "Uafhængig", aiBrug: [], marking: null, pinned: false, breaking: false, seoTitel: "", seoBeskrivelse: "",
    sprog: "da", kategoriId: "", forfatterId: user.authorId ?? "", coverMediaId: "", tagIds: [], geoTagIds: [], planlagtTid: "", version: 0,
    meta: serializeMeta(metaFromRow(null)), publiceretTid: null,
  };
}

export async function loadArticleValue(user: AuthorizedUser, id: string) {
  const row = await db.article.findFirst({
    where: { id, instansId: user.instansId },
    include: { tags: { select: { id: true } }, geoTags: { select: { id: true } }, meta: true },
  });
  if (!row) return null;
  const blocks = parseBlocks(row.blocks); // ugyldige blokke fejler højlydt (som før) frem for at blive overskrevet af en autosave
  const value: ArticleEditorValue = {
    id: row.id,
    titel: row.titel,
    manchet: row.manchet ?? "",
    slug: row.slug,
    blocks,
    status: row.status,
    indholdstype: row.indholdstype,
    aiBrug: Array.isArray(row.aiBrug) ? row.aiBrug.filter((v): v is string => typeof v === "string") : [],
    marking: (row.marking as unknown as Marking) || null,
    pinned: row.pinned,
    breaking: row.breaking,
    seoTitel: row.seoTitel ?? "",
    seoBeskrivelse: row.seoBeskrivelse ?? "",
    sprog: row.sprog,
    kategoriId: row.kategoriId ?? "",
    forfatterId: row.forfatterId ?? "",
    coverMediaId: row.coverMediaId ?? "",
    tagIds: row.tags.map((t) => t.id),
    geoTagIds: row.geoTags.map((t) => t.id),
    planlagtTid: row.planlagtTid ? row.planlagtTid.toISOString() : "",
    version: row.opdateretTid.getTime(),
    meta: serializeMeta(metaFromRow(row.meta as unknown as Record<string, unknown> | null)),
    publiceretTid: row.publiceretTid ? row.publiceretTid.toISOString() : null,
  };
  return { row, value, transitions: availableTransitions(row.status, user) };
}
