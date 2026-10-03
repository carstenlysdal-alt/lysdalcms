"use client";

import Link from "next/link";
import { useId, useState, useTransition } from "react";
import { Search } from "lucide-react";
import { KnowledgePanel } from "@/components/editor/knowledge-panel";
import { attachSourceAction, searchMaterialAction } from "@/app/redaktion/engine/actions";
import type { MaterialKind, SearchHit } from "@/lib/engine/types";
import type { CopilotCtx } from "./copilot-types";
import { useEngineBus } from "./engine-bus";

const KIND_LABEL: Record<MaterialKind, string> = { artikel: "Artikler", signal: "Signaler", tip: "Borgertip", sag: "Meddelersager", emne: "Emner" };
const ORDER: MaterialKind[] = ["artikel", "signal", "tip", "sag", "emne"];

/** Søg: mere materiale fra eget arkiv, signaler, tip og vidensarkivet. Signaler og publicerede artikler kan lægges på historien som kilde. */
export function SearchTab({ ctx, canResearch }: { ctx: CopilotCtx | null; canResearch: boolean }) {
  const inputId = useId();
  const bus = useEngineBus();
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [shown, setShown] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  function search(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    start(async () => {
      const res = await searchMaterialAction(query);
      if (!res.ok) { setHits(null); setMessage({ ok: false, text: res.error }); return; }
      setHits(res.hits);
      setShown(res.query);
    });
  }

  async function attach(hit: SearchHit) {
    setBusyId(hit.id);
    const res = await attachSourceAction(hit.id);
    setBusyId(null);
    if (!res.ok) { setMessage({ ok: false, text: res.error }); return; }
    const added = bus.addSource(res.kilde);
    setMessage({ ok: added.ok, text: added.message });
  }

  return (
    <div className="eng-stack">
      <section className="eng-card" aria-labelledby="eng-search-h">
        <header className="eng-card-head"><h3 id="eng-search-h" className="eng-card-title">Søg i materialet</h3></header>
        <form className="eng-search" role="search" onSubmit={search}>
          <label className="cms-sr-only" htmlFor={inputId}>Søg i artikler, signaler, tip og emner</label>
          <input id={inputId} className="cms-input" value={query} maxLength={100} placeholder="Navn, sted eller emne" onChange={(e) => setQuery(e.target.value)} />
          <button className="cms-btn cms-btn-secondary" type="submit" disabled={pending || query.trim().length < 2}><Search size={14} aria-hidden="true" /> {pending ? "Søger…" : "Søg"}</button>
        </form>
        <div role="status" aria-live="polite">
          {message && <p className={`eng-callout${message.ok ? " is-ok" : ""}`}>{message.text}</p>}
          {hits && hits.length === 0 && <p className="cms-muted">Ingen resultater for &quot;{shown}&quot;.</p>}
        </div>
        {hits && hits.length > 0 && ORDER.map((kind) => {
          const rows = hits.filter((h) => h.kind === kind);
          if (rows.length === 0) return null;
          return (
            <div key={kind} className="eng-group">
              <h4 className="eng-group-title">{KIND_LABEL[kind]} <span className="cms-muted">({rows.length})</span></h4>
              <ul className="eng-hits">
                {rows.map((h) => (
                  <li key={h.id} className="eng-hit">
                    <strong>{h.titel}</strong>
                    {h.uddrag && <p className="eng-hit-text">{h.uddrag}</p>}
                    <div className="eng-hit-foot">
                      <small className="cms-muted">{h.meta}</small>
                      <span className="cms-row-actions">
                        {h.href && <Link className="cms-btn cms-btn-quiet" href={h.href} target="_blank" rel="noopener noreferrer">Åbn</Link>}
                        {h.kanBruges && (
                          <button type="button" className="cms-btn cms-btn-primary-soft" disabled={!bus.editorOpen || busyId === h.id} title={bus.editorOpen ? undefined : "Åbn først en historie"} onClick={() => void attach(h)}>
                            {busyId === h.id ? "Henter…" : "Brug som kilde"}
                          </button>
                        )}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </section>
      {canResearch && <KnowledgePanel articleId={ctx?.articleId ?? null} title={ctx?.titel ?? ""} />}
    </div>
  );
}
