import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { Prisma } from "@prisma/client";
import { ArticleTable } from "@/components/admin/article-table";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can, PERMISSIONS } from "@/lib/permissions";

const tabs = ["Alle", "Publiceret", "Planlagt", "Debat"] as const;

export default async function ArticlesPage({ searchParams }: PageProps<"/artikler">) {
  const session = await auth();
  if (!session?.user) return null;
  const params = await searchParams;
  const tab = tabs.includes(params.tab as (typeof tabs)[number]) ? params.tab as string : "Alle";
  const query = typeof params.q === "string" ? params.q.trim() : "";
  const status = typeof params.status === "string" ? params.status : "";
  const type = typeof params.type === "string" ? params.type : "";
  const where: Prisma.ArticleWhereInput = {
    instansId: session.user.instansId,
    ...(query ? { titel: { contains: query } } : {}),
    ...(status ? { status } : tab === "Publiceret" ? { status: "Publiceret" } : tab === "Planlagt" ? { status: "Planlagt" } : {}),
    ...(type ? { indholdstype: type } : tab === "Debat" ? { kategori: { slug: "debat" } } : {}),
  };
  const articles = await db.article.findMany({ where, include: { forfatter: true }, orderBy: { opdateretTid: "desc" } });
  const breaking = articles.filter((article) => article.breaking);
  const pinned = articles.filter((article) => article.pinned && !article.breaking);
  const rest = articles.filter((article) => !article.breaking && !article.pinned);
  const canCreate = can(session.user, PERMISSIONS.ARTICLE_CREATE);
  const canManage = can(session.user, PERMISSIONS.FRONTPAGE_EDIT);
  return (
    <main className="admin-main">
      <div className="page-heading"><div><span className="eyebrow">CMS-01</span><h1>Publiceringsoversigt</h1><p className="text-muted">{articles.length} historier i den aktuelle visning</p></div>{canCreate && <Link className="btn btn-primary" href="/artikler/ny"><Plus size={17} /> Ny artikel</Link>}</div>
      <nav className="tabs" aria-label="Artikelvisninger">{tabs.map((item) => <Link key={item} className={tab === item ? "active" : ""} href={item === "Alle" ? "/artikler" : `/artikler?tab=${encodeURIComponent(item)}`}>{item}</Link>)}</nav>
      <form className="filter-bar">
        <label className="search-field"><Search size={17} /><input name="q" defaultValue={query} placeholder="Søg på titel" /></label>
        <select className="input" name="status" defaultValue={status}><option value="">Alle statusser</option>{["Idé", "Udkast", "Godkendelse", "Planlagt", "Publiceret", "Arkiveret"].map((item) => <option key={item}>{item}</option>)}</select>
        <select className="input" name="type" defaultValue={type}><option value="">Alle indholdstyper</option>{["Uafhængig", "Partner", "Sponsoreret", "Brugerindsendt", "PR"].map((item) => <option key={item}>{item}</option>)}</select>
        <button className="btn btn-secondary">Filtrér</button>
      </form>
      <section className="article-group"><h2>BREAKING <span>{breaking.length}</span></h2><ArticleTable articles={breaking} canManageFrontpage={canManage} /></section>
      <section className="article-group"><h2>FASTGJORT <span>{pinned.length}</span></h2><ArticleTable articles={pinned} canManageFrontpage={canManage} /></section>
      <section className="article-group"><h2>ALLE HISTORIER <span>{rest.length}</span></h2><ArticleTable articles={rest} canManageFrontpage={canManage} /></section>
    </main>
  );
}
