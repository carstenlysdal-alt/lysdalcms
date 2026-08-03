import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { ArticleForm } from "@/components/editor/article-form";
import { auth } from "@/lib/auth";
import { parseBlocks } from "@/lib/blocks/schema";
import { db } from "@/lib/db";
import { can, canEditArticle, PERMISSIONS } from "@/lib/permissions";
import { availableTransitions } from "@/lib/workflow";

export default async function EditArticlePage({ params }: PageProps<"/artikler/[id]">) {
  const session = await auth();
  if (!session?.user) return null;
  const { id } = await params;
  const [article, categories, authors, tags, geoTags] = await Promise.all([
    db.article.findFirst({ where: { id, instansId: session.user.instansId }, include: { tags: true, geoTags: true } }),
    db.category.findMany({ where: { instansId: session.user.instansId }, orderBy: { navn: "asc" } }),
    db.author.findMany({ where: { instansId: session.user.instansId }, orderBy: { navn: "asc" } }),
    db.tag.findMany({ where: { instansId: session.user.instansId }, orderBy: { navn: "asc" } }),
    db.geoTag.findMany({ where: { instansId: session.user.instansId }, orderBy: { navn: "asc" } }),
  ]);
  if (!article) notFound();
  if (!canEditArticle(session.user, article)) return <main className="admin-main"><div className="dialog inline-dialog"><h1 className="dialog-title">Ingen redigeringsadgang</h1><p className="dialog-body">Du kan kun redigere dine egne artikler.</p><Link className="btn btn-secondary" href="/artikler">Til oversigten</Link></div></main>;
  const marking = article.marking && typeof article.marking === "object" && !Array.isArray(article.marking) ? article.marking as { sponsor?: string; labelTekst?: string } : null;
  return <main className="editor-page"><div className="editor-topbar"><Link href="/artikler" className="btn btn-ghost"><ChevronLeft size={16} /> Tilbage</Link><div><span className="eyebrow">{article.status}</span><h1>{article.titel}</h1></div></div><ArticleForm article={{ id: article.id, titel: article.titel, manchet: article.manchet ?? "", slug: article.slug, blocks: parseBlocks(article.blocks), status: article.status, indholdstype: article.indholdstype, aiBrug: Array.isArray(article.aiBrug) ? article.aiBrug.filter((item): item is string => typeof item === "string") : [], marking, pinned: article.pinned, breaking: article.breaking, seoTitel: article.seoTitel ?? "", seoBeskrivelse: article.seoBeskrivelse ?? "", sprog: article.sprog, kategoriId: article.kategoriId ?? "", forfatterId: article.forfatterId ?? "", tagIds: article.tags.map((tag) => tag.id), geoTagIds: article.geoTags.map((tag) => tag.id) }} categories={categories} authors={authors} tags={tags} geoTags={geoTags} transitions={availableTransitions(article.status, session.user)} canPublish={can(session.user, PERMISSIONS.ARTICLE_PUBLISH)} /></main>;
}
