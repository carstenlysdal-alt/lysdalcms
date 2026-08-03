import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { Prisma } from "@prisma/client";
import { MediaPreview } from "@/components/media/media-preview";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can, PERMISSIONS } from "@/lib/permissions";

function formatBytes(value: number | null) {
  if (!value) return "Ekstern";
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

export default async function MediaPage({ searchParams }: PageProps<"/medier">) {
  const session = await auth();
  if (!session?.user) return null;
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q.trim() : "";
  const type = typeof params.type === "string" ? params.type : "";
  const where: Prisma.MediaWhereInput = { instansId: session.user.instansId, ...(type ? { filtype: type } : {}), ...(query ? { OR: [{ filnavn: { contains: query } }, { billedtekst: { contains: query } }, { altTekst: { contains: query } }, { ophavsperson: { contains: query } }] } : {}) };
  const media = await db.media.findMany({ where, orderBy: { createdAt: "desc" } });
  return <main className="admin-main">
    <div className="page-heading"><div><span className="eyebrow">CMS-03</span><h1>Mediebibliotek</h1><p className="text-muted">{media.length} medier i den aktuelle visning</p></div>{can(session.user, PERMISSIONS.MEDIA_MANAGE) && <Link className="btn btn-primary" href="/medier/ny"><Plus size={17} /> Tilføj medie</Link>}</div>
    <form className="filter-bar media-filter"><label className="search-field"><Search size={17} /><input name="q" defaultValue={query} placeholder="Søg filnavn, billedtekst eller ophav" /></label><select className="input" name="type" defaultValue={type}><option value="">Alle medietyper</option>{["billede", "video", "lyd", "dokument"].map((item) => <option key={item}>{item}</option>)}</select><button className="btn btn-secondary">Filtrér</button></form>
    {media.length ? <div className="media-grid">{media.map((item) => <Link className="media-card card" href={`/medier/${item.id}`} key={item.id}><div className="media-card-preview"><MediaPreview media={item} /></div><span className="tag tag-neutral">{item.filtype}</span><strong className="media-card-title">{item.billedtekst || item.filnavn || "Unavngivet medie"}</strong><small>{item.ophavsperson || "Ophav ikke angivet"} · {formatBytes(item.stoerrelse)}</small></Link>)}</div> : <div className="empty-state media-empty">Ingen medier matcher filtrene.</div>}
  </main>;
}
