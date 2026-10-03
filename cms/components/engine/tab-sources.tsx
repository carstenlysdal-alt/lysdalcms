"use client";

import { Plus, Trash2, TriangleAlert, X } from "lucide-react";
import { AiChip, CharCounter, SuggestButton } from "@/components/editor/primitives";
import type { TaskResult } from "@/lib/ai/editorial-schemas";
import { META_LIMITS } from "@/lib/article-meta";
import { GRADE_INFO, gradeFromScore, isGrade, TYPE_DEFAULTS, type SourceGrade } from "@/lib/engine/source-rating";
import type { CopilotCtx, Derived, EngineSource } from "./copilot-types";
import { GradeBadge } from "./rating-badge";

const STATUS_WORD = { ok: "I orden", warn: "Bør rettes", fail: "Mangler" } as const;
const BLANK: EngineSource = { titel: "", url: undefined, udgiver: null, dato: null, uddrag: null, type: null, rating: null };

/** Kilder: rating, uddrag fra originalen og kildegrundlag. Uddrag og rating er interne og udgives aldrig. */
export function SourcesTab({ ctx, derived }: { ctx: CopilotCtx; derived: Derived }) {
  const { kilder, setKilder, raw, ai } = ctx;
  const patch = (i: number, p: Partial<EngineSource>) => setKilder(kilder.map((k, x) => (x === i ? { ...k, ...p } : k)));

  return (
    <div className="eng-stack">
      <section className="eng-card" aria-labelledby="eng-basis-h">
        <header className="eng-card-head"><h3 id="eng-basis-h" className="eng-card-title">Kildegrundlag</h3></header>
        <ul className="eng-checks">
          {derived.basis.map((b) => (
            <li key={b.id} className={`eng-check is-${b.status}`}>
              <span className="eng-check-icon" aria-hidden="true">{b.status === "ok" ? "✓" : b.status === "warn" ? "!" : "×"}</span>
              <span><strong>{b.label}</strong> <span className="cms-sr-only">({STATUS_WORD[b.status]})</span> <small className="cms-muted">{b.hint}</small></span>
            </li>
          ))}
        </ul>
        <p className="cms-hint">Advarsler blokerer ikke udgivelse, men du kan se dem her, før du udgiver.</p>
      </section>

      <section className="eng-card" aria-labelledby="eng-src-h">
        <header className="eng-card-head">
          <h3 id="eng-src-h" className="eng-card-title">Kilder ({kilder.length})</h3>
          <button type="button" className="cms-btn cms-btn-secondary" disabled={kilder.length >= META_LIMITS.kilder} onClick={() => setKilder([...kilder, { ...BLANK }])}><Plus size={14} aria-hidden="true" /> Tilføj</button>
        </header>
        <p className="eng-note" role="note"><TriangleAlert size={14} aria-hidden="true" /> Titel, udgiver, URL og dato udgives i artiklens strukturerede data. Uddrag og rating er interne og udgives aldrig. Skriv aldrig fortrolige kilder her.</p>
        {kilder.length === 0 && <p className="cms-muted">Ingen kilder endnu. Brug et signal i feedet, eller tilføj en kilde her.</p>}
        <ul className="eng-sources">
          {kilder.map((k, i) => {
            const rating = derived.ratings[i];
            const key = `sourceRating:${i}`;
            const entry = raw.entries[key];
            return (
              <li key={i} className="eng-source">
                <details open={!k.titel.trim() || kilder.length === 1}>
                  <summary className="eng-source-summary">
                    <span className="eng-source-title">{k.titel.trim() || "Ny kilde"}</span>
                    <GradeBadge grade={rating.grade} score={rating.score} />
                  </summary>
                  <div className="eng-source-body">
                    <p className="cms-hint">{rating.begrundelse}</p>
                    {rating.foelsom && <p className="eng-callout" role="note"><TriangleAlert size={14} aria-hidden="true" /> Kan indeholde personoplysninger om sigtede, ofre eller mindreårige. Gennemlæs, før noget bruges.</p>}
                    <p className="cms-hint">{GRADE_INFO[rating.grade].kraever}</p>
                    <div className="cms-field"><label className="cms-label" htmlFor={`k${i}-t`}>Titel</label><input id={`k${i}-t`} className="cms-input" value={k.titel} maxLength={200} onChange={(e) => patch(i, { titel: e.target.value })} /></div>
                    <div className="cms-grid-2">
                      <div className="cms-field"><label className="cms-label" htmlFor={`k${i}-u`}>Udgiver</label><input id={`k${i}-u`} className="cms-input" value={k.udgiver ?? ""} maxLength={120} onChange={(e) => patch(i, { udgiver: e.target.value })} /></div>
                      <div className="cms-field"><label className="cms-label" htmlFor={`k${i}-d`}>Dato</label><input id={`k${i}-d`} className="cms-input" value={k.dato ?? ""} placeholder="ÅÅÅÅ-MM-DD" onChange={(e) => patch(i, { dato: e.target.value })} /></div>
                    </div>
                    <div className="cms-field"><label className="cms-label" htmlFor={`k${i}-l`}>URL</label><input id={`k${i}-l`} className="cms-input" value={k.url ?? ""} placeholder="https://…" onChange={(e) => patch(i, { url: e.target.value })} /></div>
                    <div className="cms-grid-2">
                      <div className="cms-field">
                        <label className="cms-label" htmlFor={`k${i}-ty`}>Kildetype</label>
                        <select id={`k${i}-ty`} className="cms-select" value={k.type ?? ""} onChange={(e) => patch(i, { type: e.target.value || null })}>
                          <option value="">Ukendt</option>
                          {Object.entries(TYPE_DEFAULTS).map(([value, v]) => <option key={value} value={value}>{v.label}</option>)}
                        </select>
                      </div>
                      <div className="cms-field">
                        <label className="cms-label" htmlFor={`k${i}-r`}>Karakter</label>
                        <select id={`k${i}-r`} className="cms-select" value={k.rating ?? ""} onChange={(e) => patch(i, { rating: isGrade(e.target.value) ? e.target.value : null })}>
                          <option value="">Automatisk ({derived.ratings[i].fra === "register" && !k.rating ? "register" : "standard"})</option>
                          {(["A", "B", "C", "D"] as const).map((g) => <option key={g} value={g}>{g} · {GRADE_INFO[g].label}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="cms-field">
                      <div className="cms-field-head">
                        <label className="cms-label" htmlFor={`k${i}-x`}>Uddrag fra originalen (internt)</label>
                        <CharCounter text={k.uddrag ?? ""} max={META_LIMITS.uddrag} />
                      </div>
                      <textarea id={`k${i}-x`} className="cms-input" rows={4} maxLength={META_LIMITS.uddrag} value={k.uddrag ?? ""} placeholder="Indsæt kildens egen tekst. Tal og citater i artiklen kontrolleres mod den." onChange={(e) => patch(i, { uddrag: e.target.value })} />
                    </div>
                    <div className="cms-row-actions">
                      <SuggestButton label="Vurdér kilden med AI" loading={entry?.status === "loading"} disabled={!ai.enabled || (!k.titel.trim() && !k.uddrag?.trim())} onClick={() => void raw.run("sourceRating", { kilde: { navn: k.udgiver || k.titel, url: k.url ?? null, type: k.type ?? null, uddrag: k.uddrag ?? null } }, key)} />
                      <button type="button" className="cms-btn cms-btn-quiet" onClick={() => setKilder(kilder.filter((_, x) => x !== i))}><Trash2 size={14} aria-hidden="true" /> Fjern kilde</button>
                    </div>
                    {entry?.status === "error" && <div className="cms-suggestion is-error" role="alert"><span>{entry.error}</span><button type="button" className="cms-icon-btn" aria-label="Luk" onClick={() => raw.dismiss(key)}><X size={16} aria-hidden="true" /></button></div>}
                    {entry?.status === "ready" && (() => {
                      const r = entry.response.suggestion as TaskResult["sourceRating"];
                      const suggested: SourceGrade = gradeFromScore(r.score);
                      return (
                        <div className="cms-suggestion" role="group" aria-label="AI-vurdering af kilden">
                          <div className="cms-suggestion-head"><AiChip>AI-vurdering — forslag</AiChip><button type="button" className="cms-btn cms-btn-quiet" onClick={() => raw.dismiss(key)}><X size={14} aria-hidden="true" /> Luk</button></div>
                          <p><GradeBadge grade={suggested} score={r.score} /> <span className="cms-muted">Score {r.score} af 100</span></p>
                          <p>{r.begrundelse}</p>
                          <ul className="eng-factors">{r.faktorer.map((f, x) => <li key={x} className={`is-${f.vurdering}`}><strong>{f.faktor}</strong> <span className="cms-muted">({f.vurdering})</span> — {f.kommentar}</li>)}</ul>
                          <div className="cms-row-actions"><button type="button" className="cms-btn cms-btn-primary-soft" onClick={() => { patch(i, { rating: suggested }); raw.dismiss(key); }}>Brug {suggested} på denne kilde</button></div>
                          <p className="cms-hint">AI kan ikke slå kilden op og vurderer kun ud fra det, du har givet den. Redaktøren beslutter.</p>
                        </div>
                      );
                    })()}
                  </div>
                </details>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
