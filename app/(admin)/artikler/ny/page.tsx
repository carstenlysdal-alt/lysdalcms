import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { ArticleForm } from "@/components/editor/article-form";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can, PERMISSIONS } from "@/lib/permissions";

export default async function NewArticlePage() {
  const session = await auth();
  if (!session?.user) return null;
  const [categories, authors, tags, geoTags] = await Promise.all([
    db.category.findMany({ where: { instansId: session.user.instansId }, orderBy: { navn: "asc" } }),
    db.author.findMany({ where: { instansId: session.user.instansId }, orderBy: { navn: "asc" } }),
    db.tag.findMany({ where: { instansId: session.user.instansId }, orderBy: { navn: "asc" } }),
    db.geoTag.findMany({ where: { instansId: session.user.instansId }, orderBy: { navn: "asc" } }),
  ]);
  return <main className="editor-page"><div className="editor-topbar"><Link href="/artikler" className="btn btn-ghost"><ChevronLeft size={16} /> Tilbage</Link><div><span className="eyebrow">Ny artikel</span><h1>Uden titel</h1></div></div><ArticleForm article={{ id: null, titel: "", manchet: "", slug: "", blocks: [{ id: "initial-paragraph", type: "paragraph", data: { content: "" } }], status: "Idé", indholdstype: "Uafhængig", aiBrug: ["Ingen"], marking: null, pinned: false, breaking: false, seoTitel: "", seoBeskrivelse: "", sprog: "da", kategoriId: "", forfatterId: session.user.authorId ?? "", tagIds: [], geoTagIds: [] }} categories={categories} authors={authors} tags={tags} geoTags={geoTags} transitions={[]} canPublish={can(session.user, PERMISSIONS.ARTICLE_PUBLISH)} /></main>;
}
