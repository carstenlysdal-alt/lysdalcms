import Link from "next/link";
import { CheckCheck, Plus, Settings } from "lucide-react";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can, PERMISSIONS } from "@/lib/permissions";
import { markAllRead, createSignal } from "./actions";

function relativeTime(date: Date) {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "nu";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}t`;
  return `${Math.floor(hrs / 24)}d`;
}

const KILDER = ["Alle", "Ritzau", "Reuters", "AP", "Intern"];

export default async function SignalerPage({ searchParams }: PageProps<"/signaler">) {
  const session = await auth();
  if (!session?.user) return null;
  const params = await searchParams;
  const kilde = typeof params.kilde === "string" ? params.kilde : "";
  const visLaeste = params.laest === "1";

  const signals = await db.signal.findMany({
    where: {
      instansId: session.user.instansId,
      ...(kilde && kilde !== "Alle" ? { kilde } : {}),
      ...(visLaeste ? {} : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const ulaeste = signals.filter((s) => !s.laest).length;
  const visninger = visLaeste ? signals : signals.filter((s) => !s.laest);
  const canManage = can(session.user, PERMISSIONS.ARTICLE_CREATE);

  return (
    <main className="admin-main">
      <div className="page-heading">
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
          <span className="signal-live-dot" aria-hidden />
          <h1 style={{ margin: 0 }}>Signaler</h1>
          {ulaeste > 0 && <span className="tag tag-accent">{ulaeste}</span>}
        </div>
        <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
          <form action={markAllRead}>
            <button className="btn btn-secondary" type="submit"><CheckCheck size={16} /> Markér alle læst</button>
          </form>
          {canManage && (
            <button className="btn btn-secondary" onClick={undefined} data-dialog="new-signal">
              <Settings size={16} /> Administrér
            </button>
          )}
        </div>
      </div>

      <p className="text-muted" style={{ marginBottom: "var(--space-4)" }}>
        Alt din live-overvågning fanger, nyeste først — på tværs af alle kilder.
      </p>

      {/* Kildefilter */}
      <div className="quick-filters" style={{ marginBottom: "var(--space-4)" }}>
        {KILDER.map((k) => (
          <Link key={k} className={`quick-filter ${(k === "Alle" && !kilde) || kilde === k ? "active" : ""}`} href={k === "Alle" ? "/signaler" : `/signaler?kilde=${k}`}>
            {k === "Alle" ? `Alle ${signals.length}` : k}
          </Link>
        ))}
        <Link className={`quick-filter ${visLaeste ? "active" : ""}`} href={visLaeste ? "/signaler" : "/signaler?laest=1"} style={{ marginLeft: "auto" }}>
          Vis læste
        </Link>
      </div>

      {/* Nyt signal-form (kun for redaktører) */}
      {canManage && (
        <details className="signal-new-panel">
          <summary className="btn btn-secondary" style={{ display: "inline-flex", gap: 6, cursor: "pointer", marginBottom: "var(--space-4)" }}>
            <Plus size={16} /> Tilføj signal manuelt
          </summary>
          <form action={createSignal} className="stack" style={{ maxWidth: 640, marginTop: "var(--space-3)", padding: "var(--space-4)", background: "var(--color-surface)", borderRadius: "var(--radius-md)", border: "1px solid var(--color-divider)" }}>
            <div className="field"><label htmlFor="overskrift">Overskrift *</label><input className="input" id="overskrift" name="overskrift" required /></div>
            <div className="field"><label htmlFor="brødtekst">Brødtekst</label><textarea className="input" id="brødtekst" name="brødtekst" rows={2} /></div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
              <div className="field"><label htmlFor="kilde">Kilde</label><select className="input" id="kilde" name="kilde">{["Intern", "Ritzau", "Reuters", "AP"].map((k) => <option key={k}>{k}</option>)}</select></div>
              <div className="field"><label htmlFor="kildeUrl">Kilde-URL</label><input className="input" id="kildeUrl" name="kildeUrl" type="url" /></div>
            </div>
            <div style={{ display: "flex", gap: "var(--space-4)" }}>
              <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13 }}><input type="checkbox" name="notable" /> Notable</label>
              <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13 }}><input type="checkbox" name="breaking" /> Breaking</label>
            </div>
            <div><button className="btn btn-primary" type="submit">Tilføj signal</button></div>
          </form>
        </details>
      )}

      {/* Feed */}
      <div className="signal-feed">
        {visninger.length === 0 ? (
          <div className="empty-state">Ingen ulæste signaler. {!visLaeste && <Link href="/signaler?laest=1">Vis læste</Link>}</div>
        ) : (
          visninger.map((signal) => (
            <div key={signal.id} className={`signal-item ${signal.laest ? "signal-read" : ""}`}>
              <div className="signal-source">
                <span className="signal-source-label">{signal.kilde}</span>
                {!signal.laest && <span className="signal-live-dot" style={{ width: 7, height: 7 }} />}
              </div>
              <div className="signal-content">
                <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", marginBottom: 4 }}>
                  {signal.breaking && <span className="tag" style={{ background: "var(--color-danger)", color: "#fff", borderRadius: 9999, fontSize: 9 }}>Breaking</span>}
                  {signal.notable && <span className="tag tag-success">Notable</span>}
                </div>
                <p className="signal-headline">{signal.overskrift}</p>
                {signal.brødtekst && <p className="signal-body">{signal.brødtekst}</p>}
                {signal.kildeUrl && <a href={signal.kildeUrl} target="_blank" rel="noopener" className="signal-link">{signal.kilde} ↗</a>}
              </div>
              <div className="signal-meta">
                <span className="signal-time">{relativeTime(signal.createdAt)}</span>
                <Link className="btn btn-secondary" style={{ fontSize: 11, padding: "3px 10px" }} href={`/chat?signal=${encodeURIComponent(signal.overskrift)}`}>
                  Skriv
                </Link>
              </div>
            </div>
          ))
        )}
      </div>
    </main>
  );
}
