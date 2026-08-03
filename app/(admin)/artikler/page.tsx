import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { Prisma } from "@prisma/client";
import { ArticleTable } from "@/components/admin/article-table";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can, PERMISSIONS } from "@/lib/permissions";

const tabs = ["Alle", "Publiceret", "Planlagt", "Meninger", "Debat"] as const;

export default async function ArticlesPage({ searchParams }: PageProps<"/artikler">) {
  const session = await auth();
  if (!session?.user) return null;
  const params = await searchParams;
  const tab = tabs.includes(params.tab as (typeof tabs)[number]) ? params.tab as string : "Alle";
  const query = typeof params.q === "string" ? params.q.trim() : "";
  const status = typeof params.status === "string" ? params.status : "";
  const type = typeof params.type === "string" ? params.type : "";
  const sort = params.sort === "aeldste" ? "asc" : "desc";
  const filterBreaking = params.breaking === "1";
  const filterPinned = params.pinned === "1";
  const filterSponsored = params.sponsored === "1";

  const where: Prisma.ArticleWhereInput = {
    instansId: session.user.instansId,
    ...(query ? { titel: { contains: query } } : {}),
    ...(status ? { status } : tab === "Publiceret" ? { status: "Publiceret" } : tab === "Planlagt" ? { status: "Planlagt" } : {}),
    ...(type ? { indholdstype: type } : filterSponsored ? { indholdstype: "Sponsoreret" } : tab === "Debat" ? { kategori: { slug: "debat" } } : tab === "Meninger" ? { indholdstype: "Brugerindsendt" } : {}),
    ...(filterBreaking ? { breaking: true } : {}),
    ...(filterPinned ? { pinned: true } : {}),
  };

  const articles = await db.article.findMany({
    where,
    include: { forfatter: true, coverMedia: true },
    orderBy: { opdateretTid: sort },
  });

  const breaking = articles.filter((a) => a.breaking);
  const pinned = articles.filter((a) => a.pinned && !a.breaking);
  const rest = articles.filter((a) => !a.breaking && !a.pinned);
  const canCreate = can(session.user, PERMISSIONS.ARTICLE_CREATE);
  const canManage = can(session.user, PERMISSIONS.FRONTPAGE_EDIT);

  function filterHref(extra: Record<string, string>) {
    const p = new URLSearchParams();
    if (tab !== "Alle") p.set("tab", tab);
    if (query) p.set("q", query);
    if (status) p.set("status", status);
    if (type) p.set("type", type);
    if (sort === "asc") p.set("sort", "aeldste");
    Object.entries(extra).forEach(([k, v]) => v ? p.set(k, v) : p.delete(k));
    const s = p.toString();
    return `/artikler${s ? `?${s}` : ""}`;
  }

  return (
    <main className="admin-main">
      <div className="page-heading">
        <div>
          <h1>Publiceringsoversigt</h1>
          <p className="text-muted">{articles.length} historier i den aktuelle visning</p>
        </div>
        {canCreate && <Link className="btn btn-primary" href="/artikler/ny"><Plus size={17} /> Ny artikel</Link>}
      </div>

      <nav className="tabs" aria-label="Artikelvisninger">
        {tabs.map((item) => (
          <Link key={item} className={tab === item ? "active" : ""} href={item === "Alle" ? "/artikler" : `/artikler?tab=${encodeURIComponent(item)}`}>
            {item}
          </Link>
        ))}
      </nav>

      <form className="filter-bar">
        <label className="search-field"><Search size={17} /><input name="q" defaultValue={query} placeholder="Søg på titel" /></label>
        <select className="input" name="status" defaultValue={status}>
          <option value="">Alle statusser</option>
          {["Idé", "Udkast", "Godkendelse", "Planlagt", "Publiceret", "Arkiveret"].map((s) => <option key={s}>{s}</option>)}
        </select>
        <select className="input" name="sort" defaultValue={sort === "asc" ? "aeldste" : "nyeste"}>
          <option value="nyeste">Nyeste først</option>
          <option value="aeldste">Ældste først</option>
        </select>
        <button className="btn btn-secondary">Filtrér</button>
      </form>

      {canManage && (
        <div className="quick-filters">
          <Link className={`quick-filter ${filterBreaking ? "active" : ""}`} href={filterHref({ breaking: filterBreaking ? "" : "1" })}>
            Breaking
          </Link>
          <Link className={`quick-filter ${filterSponsored ? "active" : ""}`} href={filterHref({ sponsored: filterSponsored ? "" : "1" })}>
            Sponsoreret
          </Link>
          <Link className={`quick-filter ${filterPinned ? "active" : ""}`} href={filterHref({ pinned: filterPinned ? "" : "1" })}>
            Fastgjort
          </Link>
        </div>
      )}

      <section className="article-group">
        <h2>BREAKING <span>{breaking.length}</span></h2>
        <ArticleTable articles={breaking} canManageFrontpage={canManage} />
      </section>
      <section className="article-group">
        <h2>FASTGJORT <span>{pinned.length}</span></h2>
        <ArticleTable articles={pinned} canManageFrontpage={canManage} />
      </section>
      <section className="article-group">
        <h2>ALLE HISTORIER <span>{rest.length}</span></h2>
        <ArticleTable articles={rest} canManageFrontpage={canManage} />
      </section>
    </main>
  );
}
