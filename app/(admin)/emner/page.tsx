import Link from "next/link";
import { Plus, Search, Settings } from "lucide-react";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can, PERMISSIONS } from "@/lib/permissions";

function formatTime(date: Date) {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "nu";
  if (mins < 60) return `${mins}m siden`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}t siden`;
  return new Intl.DateTimeFormat("da-DK", { dateStyle: "short" }).format(date);
}

export default async function EmnerPage({ searchParams }: PageProps<"/emner">) {
  const session = await auth();
  if (!session?.user) return null;
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q.trim() : "";
  const kategori = typeof params.kategori === "string" ? params.kategori : "";

  const topics = await db.topic.findMany({
    where: {
      instansId: session.user.instansId,
      ...(query ? { titel: { contains: query } } : {}),
    },
    orderBy: { updatedAt: "desc" },
  });

  const kategorier = Array.from(new Set(topics.flatMap((t) => t.kategorier as string[]))).sort();
  const filtered = kategori ? topics.filter((t) => (t.kategorier as string[]).includes(kategori)) : topics;
  const canManage = can(session.user, PERMISSIONS.ARTICLE_CREATE);

  return (
    <main className="admin-main">
      <div className="page-heading">
        <div>
          <h1>Emner</h1>
          <p className="text-muted">Nye leads fra dine emner — åbn et for at se kilder, skriv så historien.</p>
        </div>
        <div style={{ display: "flex", gap: "var(--space-2)" }}>
          {canManage && <Link className="btn btn-secondary" href="/emner/administrer"><Settings size={16} /> Administrér emner</Link>}
          {canManage && <Link className="btn btn-primary" href="/emner/ny"><Plus size={16} /> Nyt emne</Link>}
        </div>
      </div>

      <form className="filter-bar" style={{ gridTemplateColumns: "1fr auto" }}>
        <label className="search-field"><Search size={17} /><input name="q" defaultValue={query} placeholder="Søg emner…" /></label>
        <button className="btn btn-secondary">Søg</button>
      </form>

      {kategorier.length > 0 && (
        <div className="quick-filters" style={{ marginBottom: "var(--space-6)" }}>
          <Link className={`quick-filter ${!kategori ? "active" : ""}`} href="/emner">
            Alle emner {topics.length}
          </Link>
          {kategorier.map((k) => {
            const count = topics.filter((t) => (t.kategorier as string[]).includes(k)).length;
            return (
              <Link key={k} className={`quick-filter ${kategori === k ? "active" : ""}`} href={`/emner?kategori=${encodeURIComponent(k)}`}>
                {k} {count}
              </Link>
            );
          })}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="empty-state media-empty">
          Ingen emner endnu. Opret et emne for at begynde at overvåge historier.
        </div>
      ) : (
        <div className="topic-grid">
          {filtered.map((topic) => (
            <Link key={topic.id} href={`/chat?emne=${encodeURIComponent(topic.titel)}`} className="topic-card">
              <div className="topic-cover">
                {topic.coverUrl
                  ? <img src={topic.coverUrl} alt={topic.titel} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : <div className="topic-cover-placeholder" />}
              </div>
              <div className="topic-body">
                <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 6, flexWrap: "wrap" }}>
                  {topic.notable && <span className="tag tag-success">Notable</span>}
                  {(topic.kategorier as string[]).slice(0, 2).map((k) => (
                    <span key={k} className="tag tag-neutral">{k}</span>
                  ))}
                </div>
                <strong className="topic-title">{topic.titel}</strong>
                {topic.beskrivelse && <p className="topic-desc">{topic.beskrivelse}</p>}
                <div className="topic-meta">
                  <span>{topic.kildeAntal} {topic.kildeAntal === 1 ? "kilde" : "kilder"}</span>
                  <span>Opdateret {formatTime(topic.updatedAt)}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
