"use client";

import { Check, CircleAlert, TriangleAlert, X } from "lucide-react";
import { AiChip, CharCounter, SuggestButton } from "@/components/editor/primitives";
import type { TaskResult } from "@/lib/ai/editorial-schemas";
import type { CopilotCtx, Derived } from "./copilot-types";

type Status = "ok" | "warn" | "fail";
const ICON: Record<Status, React.ReactNode> = {
  ok: <Check size={14} aria-hidden="true" />,
  warn: <TriangleAlert size={14} aria-hidden="true" />,
  fail: <CircleAlert size={14} aria-hidden="true" />,
};
const WORD: Record<Status, string> = { ok: "I orden", warn: "Bør rettes", fail: "Mangler" };

function CheckList({ items }: { items: Array<{ id: string; label: string; status: Status; hint: string }> }) {
  const order: Status[] = ["fail", "warn", "ok"];
  const sorted = [...items].sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status));
  return (
    <ul className="eng-checks">
      {sorted.map((c) => (
        <li key={c.id} className={`eng-check is-${c.status}`}>
          <span className="eng-check-icon">{ICON[c.status]}<span className="cms-sr-only">{WORD[c.status]}: </span></span>
          <span><strong>{c.label}</strong> <small className="cms-muted">{c.hint}</small></span>
        </li>
      ))}
    </ul>
  );
}

function Ring({ value, label }: { value: number; label: string }) {
  const tone = value >= 80 ? "ok" : value >= 50 ? "warn" : "bad";
  return <span className={`cms-score-num is-${tone}`} role="img" aria-label={`${label}: ${value} af 100`}>{value}</span>;
}

/** Kvalitet: SEO-score, læsbarhed og rubrikkens form (alt deterministisk), plus AI-vurderinger der kun er forslag. */
export function QualityTab({ ctx, derived }: { ctx: CopilotCtx; derived: Derived }) {
  const { score, ai, raw } = ctx;
  const { read, headline } = derived;
  const headlineEntry = raw.entries.headlineRating;
  const canRate = ai.enabled && ctx.titel.trim().length >= 3 && ctx.wordCount >= 15;

  return (
    <div className="eng-stack">
      <section className="eng-card" aria-labelledby="eng-seo-h">
        <header className="eng-card-head"><h3 id="eng-seo-h" className="eng-card-title">SEO og metadata</h3></header>
        <div className="eng-score-row">
          <Ring value={score.score} label="SEO-score" />
          <p className="cms-hint">{score.complete ? "Al metadata er komplet." : `${score.items.filter((i) => i.status !== "ok").length} punkter bør rettes, før du udgiver.`} Scoren er udregnet efter faste regler, ikke af AI.</p>
        </div>
        <CheckList items={score.items} />
        <div className="eng-row-actions">
          <SuggestButton label="Kommentér scoren" loading={ai.loading("seoComment")} disabled={!ai.enabled} onClick={() => ai.run("seoComment", { score: { score: score.score, items: score.items.map((i) => ({ label: i.label, status: i.status, hint: i.hint })) } })} />
        </div>
        {ai.tray("seoComment")}
      </section>

      <section className="eng-card" aria-labelledby="eng-lix-h">
        <header className="eng-card-head"><h3 id="eng-lix-h" className="eng-card-title">Læsbarhed</h3></header>
        <dl className="eng-metrics">
          <div><dt>LIX</dt><dd>{read.words === 0 ? "—" : read.lix}</dd></div>
          <div><dt>Niveau</dt><dd>{read.words === 0 ? "—" : read.label}</dd></div>
          <div><dt>Ord pr. sætning</dt><dd>{read.words === 0 ? "—" : read.avgSentenceWords}</dd></div>
          <div><dt>Ord</dt><dd>{read.words}</dd></div>
        </dl>
        {read.words > 0 && <p className={`cms-hint${read.fitForNews ? "" : " is-warn"}`}>{read.fitForNews ? "Niveauet passer til en lokalnyhed (LIX højst 45)." : "Teksten er tung for en lokalnyhed. Korte sætninger og færre lange ord hjælper."}</p>}
        {read.longSentences.length > 0 && (
          <>
            <p className="cms-label">Meget lange sætninger (over 30 ord)</p>
            <ul className="eng-quotes">{read.longSentences.map((s, i) => <li key={i}>{s}</li>)}</ul>
          </>
        )}
      </section>

      <section className="eng-card" aria-labelledby="eng-head-h">
        <header className="eng-card-head">
          <h3 id="eng-head-h" className="eng-card-title">Rubrik</h3>
          <CharCounter text={ctx.titel} max={110} />
        </header>
        <CheckList items={headline} />
        <div className="eng-row-actions">
          <SuggestButton label="Vurdér rubrikken" loading={headlineEntry?.status === "loading"} disabled={!canRate} reason={!canRate && ai.enabled ? "Skriv en rubrik og lidt brødtekst først." : null} onClick={() => void raw.run("headlineRating", {}, "headlineRating")} />
        </div>
        {headlineEntry?.status === "error" && (
          <div className="cms-suggestion is-error" role="alert"><span>{headlineEntry.error}</span><button type="button" className="cms-icon-btn" aria-label="Luk" onClick={() => raw.dismiss("headlineRating")}><X size={16} aria-hidden="true" /></button></div>
        )}
        {headlineEntry?.status === "ready" && (() => {
          const r = headlineEntry.response.suggestion as TaskResult["headlineRating"];
          return (
            <div className="cms-suggestion" role="group" aria-label="AI-vurdering af rubrikken">
              <div className="cms-suggestion-head">
                <AiChip>AI-vurdering</AiChip>
                <button type="button" className="cms-btn cms-btn-quiet" onClick={() => raw.dismiss("headlineRating")}><X size={14} aria-hidden="true" /> Luk</button>
              </div>
              <div className="eng-score-row"><Ring value={r.score} label="Rubrikscore" /><p>{r.begrundelse}</p></div>
              <ul className="eng-bars">
                {r.delscorer.map((d, i) => (
                  <li key={i}>
                    <div className="eng-bar-head"><span>{d.kriterium}</span><span>{d.score}</span></div>
                    <div className="eng-bar" aria-hidden="true"><span style={{ width: `${d.score}%` }} /></div>
                    <small className="cms-muted">{d.kommentar}</small>
                  </li>
                ))}
              </ul>
              {r.forbedring && <p><strong>Forslag:</strong> {r.forbedring}</p>}
              <p className="cms-hint">AI&apos;s vurdering ud fra teksten. Det er hverken målt klikrate eller læsertal.</p>
            </div>
          );
        })()}
      </section>
    </div>
  );
}
