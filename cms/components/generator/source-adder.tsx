"use client";

import { useRef, useState, useTransition } from "react";
import { FileText, Globe, Radio, Type } from "lucide-react";
import { addTextSourceAction, fetchUrlSourceAction, readPdfSourceAction } from "@/app/redaktion/engine/generer/actions";
import type { SourceDraftResult } from "@/lib/generate/ingest";
import { newKey, type ClientSource, type SignalOption } from "./types";

type Tab = "feed" | "url" | "pdf" | "tekst";
const TABS: Array<{ id: Tab; label: string; icon: typeof Globe }> = [
  { id: "feed", label: "Feed", icon: Radio },
  { id: "url", label: "Webadresse", icon: Globe },
  { id: "pdf", label: "PDF", icon: FileText },
  { id: "tekst", label: "Tekst", icon: Type },
];

function toSource(res: Extract<SourceDraftResult, { ok: true }>): ClientSource {
  const k = res.kilde;
  return { key: newKey(), kind: k.kind, titel: k.titel, udgiver: k.udgiver, url: k.url, dato: k.dato, type: k.type, tekst: k.tekst, billeder: k.billeder.map((b) => ({ ...b, brug: false })), noter: res.advarsler };
}

/** Fire måder at lægge materiale i grundlaget: feedkort, webadresse (inkl. PDF-link og billedreferencer), uploadet PDF og indsat tekst. */
export function SourceAdder({ signals, usedSignalIds, full, onAdd }: { signals: SignalOption[]; usedSignalIds: ReadonlySet<string>; full: boolean; onAdd: (source: ClientSource) => void }) {
  const [tab, setTab] = useState<Tab>("feed");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState({ titel: "", udgiver: "", dato: "", tekst: "" });
  const [filter, setFilter] = useState("");

  const run = (job: () => Promise<SourceDraftResult>, done?: () => void) => {
    setError(null);
    startTransition(async () => {
      const res = await job();
      if (!res.ok) return setError(res.error);
      onAdd(toSource(res));
      done?.();
    });
  };

  const shown = signals.filter((s) => !filter.trim() || `${s.titel} ${s.kilde}`.toLowerCase().includes(filter.trim().toLowerCase()));

  return (
    <section className="gen-add" aria-labelledby="gen-add-h">
      <h3 id="gen-add-h" className="gen-h3">Tilføj kilde</h3>
      <div className="eng-tabs" role="tablist" aria-label="Kildetype">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" role="tab" id={`gen-tab-${id}`} aria-selected={tab === id} aria-controls={`gen-panel-${id}`} className="eng-tab" onClick={() => { setTab(id); setError(null); }}>
            <Icon size={14} aria-hidden="true" /> {label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`gen-panel-${tab}`} aria-labelledby={`gen-tab-${tab}`} className="gen-add-panel">
        {full && <p className="gen-hint" role="status">Der er plads til højst 8 kilder. Fjern en, før du tilføjer flere.</p>}

        {tab === "feed" && (
          <>
            <input type="search" className="cms-input" placeholder="Søg i signaler…" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Søg i signaler" />
            {shown.length === 0 ? <p className="gen-hint">Ingen signaler matcher.</p> : (
              <ul className="gen-signals">
                {shown.map((s) => {
                  const used = usedSignalIds.has(s.id);
                  return (
                    <li key={s.id} className="gen-signal">
                      <div className="gen-signal-main">
                        <strong>{s.titel}</strong>
                        <span className="gen-meta">{s.kilde}{s.type ? ` · ${s.type}` : ""}{!s.harTekst ? " · ingen brødtekst" : ""}</span>
                        {s.spaerret && <span className="gen-meta gen-warn">Spærret: politi/112 kan ikke danne grundlag for AI-tekst</span>}
                      </div>
                      <button type="button" className="cms-btn cms-btn-secondary" disabled={used || s.spaerret || !s.harTekst || full} onClick={() => onAdd({ key: newKey(), kind: "signal", signalId: s.id, titel: s.titel, udgiver: s.kilde, url: null, dato: s.tidIso.slice(0, 10), type: s.type, tekst: "", billeder: [], noter: [] })}>
                        {used ? "Tilføjet" : "Tilføj"}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}

        {tab === "url" && (
          <form onSubmit={(e) => { e.preventDefault(); run(() => fetchUrlSourceAction(url), () => setUrl("")); }} className="gen-form">
            <label className="gen-label" htmlFor="gen-url">Adresse på artikel, pressemeddelelse eller PDF</label>
            <input id="gen-url" type="url" className="cms-input" placeholder="https://…" value={url} onChange={(e) => setUrl(e.target.value)} required aria-describedby="gen-url-hint" />
            <p id="gen-url-hint" className="gen-hint">Siden hentes sikkert og læses som tekst. Billeder hentes ikke; kun adresse, alt-tekst og billedtekst gemmes som reference, så rettigheder kan afklares først.</p>
            <button type="submit" className="cms-btn cms-btn-primary" disabled={pending || full || !url.trim()}>{pending ? "Henter…" : "Hent kilde"}</button>
          </form>
        )}

        {tab === "pdf" && (
          <form onSubmit={(e) => { e.preventDefault(); const f = fileRef.current?.files?.[0]; if (!f) return setError("Vælg en PDF-fil."); const fd = new FormData(); fd.set("fil", f); run(() => readPdfSourceAction(fd), () => { if (fileRef.current) fileRef.current.value = ""; }); }} className="gen-form">
            <label className="gen-label" htmlFor="gen-pdf">PDF-fil (højst 10 MB)</label>
            <input id="gen-pdf" ref={fileRef} type="file" accept="application/pdf,.pdf" className="cms-input" required />
            <p className="gen-hint">Kun filer med tekstlag kan læses. Scannede sider skal indsættes som tekst.</p>
            <button type="submit" className="cms-btn cms-btn-primary" disabled={pending || full}>{pending ? "Læser…" : "Læs PDF"}</button>
          </form>
        )}

        {tab === "tekst" && (
          <form onSubmit={(e) => { e.preventDefault(); run(() => addTextSourceAction({ titel: text.titel, udgiver: text.udgiver || null, dato: text.dato || null, tekst: text.tekst }), () => setText({ titel: "", udgiver: "", dato: "", tekst: "" })); }} className="gen-form">
            <div className="gen-grid2">
              <div><label className="gen-label" htmlFor="gen-t-titel">Titel</label><input id="gen-t-titel" className="cms-input" value={text.titel} onChange={(e) => setText({ ...text, titel: e.target.value })} maxLength={300} required /></div>
              <div><label className="gen-label" htmlFor="gen-t-udgiver">Afsender</label><input id="gen-t-udgiver" className="cms-input" value={text.udgiver} onChange={(e) => setText({ ...text, udgiver: e.target.value })} maxLength={160} /></div>
            </div>
            <div><label className="gen-label" htmlFor="gen-t-dato">Dato</label><input id="gen-t-dato" type="date" className="cms-input gen-date" value={text.dato} onChange={(e) => setText({ ...text, dato: e.target.value })} /></div>
            <div><label className="gen-label" htmlFor="gen-t-tekst">Tekst</label><textarea id="gen-t-tekst" className="cms-input" rows={7} value={text.tekst} onChange={(e) => setText({ ...text, tekst: e.target.value })} required minLength={50} /></div>
            <button type="submit" className="cms-btn cms-btn-primary" disabled={pending || full || text.tekst.trim().length < 50}>Tilføj tekst</button>
          </form>
        )}
        {error && <p className="gen-error" role="alert">{error}</p>}
      </div>
    </section>
  );
}
