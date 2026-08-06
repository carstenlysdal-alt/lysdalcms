import Link from "next/link";
import { MoreHorizontal, Pin, Radio } from "lucide-react";
import type { Article, Author, Media } from "@prisma/client";
import { toggleArticleFlag } from "@/app/(admin)/artikler/actions";

type Row = Article & { forfatter: Author | null; coverMedia: Media | null };

function statusBadge(status: string) {
  if (status === "Publiceret" || status === "Distribueret") return { cls: "badge-live", label: "Live" };
  if (status === "Planlagt") return { cls: "badge-planned", label: "Planlagt" };
  if (status === "Arkiveret" || status === "Afvist") return { cls: "badge-planned", label: status };
  return { cls: "badge-planned", label: status };
}

function date(value: Date | null) {
  return value ? new Intl.DateTimeFormat("da-DK", { dateStyle: "short", timeStyle: "short" }).format(value) : "—";
}

function relativeTime(value: Date | null) {
  if (!value) return null;
  const diff = Date.now() - value.getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "nu";
  if (mins < 60) return `${mins}m siden`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}t siden`;
  const days = Math.floor(hrs / 24);
  return `${days}d siden`;
}

function initials(name: string | null | undefined) {
  if (!name) return "?";
  return name.split(" ").filter(Boolean).map((n) => n[0]).slice(0, 2).join("").toUpperCase();
}

const avatarStyle: React.CSSProperties = {
  width: 30, height: 30, borderRadius: "50%", flexShrink: 0,
  background: "var(--color-accent-100)", color: "var(--color-accent-700)",
  border: "1px solid var(--color-accent-300)",
  fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700,
  display: "flex", alignItems: "center", justifyContent: "center",
};

export function ArticleTable({ articles, canManageFrontpage }: { articles: Row[]; canManageFrontpage: boolean }) {
  if (!articles.length) return <div className="empty-state">Ingen historier i denne sektion.</div>;
  return (
    <div className="article-card-list">
      {articles.map((article) => {
        const status = statusBadge(article.status);
        return (
          <div className="article-card" key={article.id}>
            <div className="article-card-thumb">
              {article.coverMedia?.url ? (
                <img src={article.coverMedia.url} alt={article.coverMedia.altTekst ?? ""} />
              ) : null}
            </div>
            <div className="article-card-body">
              <div className="article-card-title">
                {article.breaking && <span className="badge badge-breaking">Breaking</span>}
                {article.pinned && !article.breaking && <Pin size={12} style={{ color: "var(--color-accent-2-600)", flexShrink: 0 }} />}
                <Link className="article-title-link" href={`/artikler/${article.id}`}>{article.titel}</Link>
              </div>
              {article.manchet && <span className="table-subtitle" style={{ maxWidth: 520 }}>{article.manchet}</span>}
              <div className="article-card-meta">
                <span title={article.forfatter?.navn ?? "Ikke tildelt"} style={avatarStyle}>{initials(article.forfatter?.navn)}</span>
                <span>{article.forfatter?.navn ?? "Ikke tildelt"}</span>
                <span>·</span>
                <span title={date(article.opdateretTid)}>{article.publiceretTid ? date(article.publiceretTid) : relativeTime(article.opdateretTid)}</span>
              </div>
            </div>
            <div className="article-card-side">
              <span className={`badge ${status.cls}`}><span className="badge-dot" /> {status.label}</span>
              <span className={`tag ${article.indholdstype === "Sponsoreret" ? "tag-accent" : article.indholdstype === "Partner" ? "tag-warn" : "tag-neutral"}`}>
                {article.indholdstype}
              </span>
              <div className="row-actions">
                <form action={toggleArticleFlag.bind(null, article.id, "pinned")}>
                  <button className={`btn btn-icon btn-ghost ${article.pinned ? "is-active" : ""}`} disabled={!canManageFrontpage} title={article.pinned ? "Fjern fastgørelse" : "Fastgør"}><Pin size={16} /></button>
                </form>
                <form action={toggleArticleFlag.bind(null, article.id, "breaking")}>
                  <button className={`btn btn-icon btn-ghost ${article.breaking ? "is-active" : ""}`} disabled={!canManageFrontpage} title={article.breaking ? "Fjern breaking" : "Markér breaking"}><Radio size={16} /></button>
                </form>
                <Link className="btn btn-icon btn-ghost" href={`/artikler/${article.id}`} title="Redigér"><MoreHorizontal size={18} /></Link>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
