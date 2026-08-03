import Link from "next/link";
import { MoreHorizontal, Pin, Radio } from "lucide-react";
import type { Article, Author, Media } from "@prisma/client";
import { toggleArticleFlag } from "@/app/(admin)/artikler/actions";

type Row = Article & { forfatter: Author | null; coverMedia: Media | null };

function statusClass(status: string) {
  if (status === "Publiceret" || status === "Distribueret") return "dot-published";
  if (status === "Planlagt") return "dot-scheduled";
  if (status === "Arkiveret" || status === "Afvist") return "dot-archived";
  return "dot-draft";
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

export function ArticleTable({ articles, canManageFrontpage }: { articles: Row[]; canManageFrontpage: boolean }) {
  if (!articles.length) return <div className="empty-state">Ingen historier i denne sektion.</div>;
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th style={{ width: 48 }}><span className="sr-only">Billede</span></th>
            <th>Titel</th>
            <th>Status</th>
            <th>Indholdstype</th>
            <th>Forfatter</th>
            <th>Publicering</th>
            <th>Opdateret</th>
            <th><span className="sr-only">Handlinger</span></th>
          </tr>
        </thead>
        <tbody>
          {articles.map((article) => (
            <tr key={article.id}>
              <td style={{ padding: "6px 8px 6px 0" }}>
                {article.coverMedia?.url ? (
                  <img
                    src={article.coverMedia.url}
                    alt={article.coverMedia.altTekst ?? ""}
                    width={48}
                    height={48}
                    style={{ width: 48, height: 48, objectFit: "cover", borderRadius: "var(--radius-sm)", display: "block", flexShrink: 0 }}
                  />
                ) : (
                  <div style={{ width: 48, height: 48, borderRadius: "var(--radius-sm)", background: "var(--color-neutral-200)", flexShrink: 0 }} />
                )}
              </td>
              <td>
                <Link className="article-title-link" href={`/artikler/${article.id}`}>{article.titel}</Link>
                {article.manchet && <small className="table-subtitle">{article.manchet}</small>}
              </td>
              <td><span className={`dot-status ${statusClass(article.status)}`} /> {article.status}</td>
              <td><span className={`tag ${article.indholdstype === "Sponsoreret" ? "tag-accent" : article.indholdstype === "Partner" ? "tag-warn" : "tag-neutral"}`}>{article.indholdstype}</span></td>
              <td>{article.forfatter?.navn ?? "Ikke tildelt"}</td>
              <td>{date(article.publiceretTid)}</td>
              <td>
                <span title={date(article.opdateretTid)}>{relativeTime(article.opdateretTid)}</span>
              </td>
              <td>
                <div className="row-actions">
                  <form action={toggleArticleFlag.bind(null, article.id, "pinned")}>
                    <button className={`btn btn-icon btn-ghost ${article.pinned ? "is-active" : ""}`} disabled={!canManageFrontpage} title={article.pinned ? "Fjern fastgørelse" : "Fastgør"}><Pin size={16} /></button>
                  </form>
                  <form action={toggleArticleFlag.bind(null, article.id, "breaking")}>
                    <button className={`btn btn-icon btn-ghost ${article.breaking ? "is-active" : ""}`} disabled={!canManageFrontpage} title={article.breaking ? "Fjern breaking" : "Markér breaking"}><Radio size={16} /></button>
                  </form>
                  <Link className="btn btn-icon btn-ghost" href={`/artikler/${article.id}`} title="Redigér"><MoreHorizontal size={18} /></Link>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
