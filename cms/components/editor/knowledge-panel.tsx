"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { ResearchResponse, ResearchResult } from "@/lib/knowledge/contracts";
import { Accordion } from "./primitives";

/** Pure escaped text presentation: retrieved instructions never become actions/HTML. */
export function KnowledgeResults({ result }: { result: ResearchResult }) {
  if (result.status === "disabled") return <p className="cms-hint">Redaktionens vidensarkiv er ikke tilsluttet for denne by endnu.</p>;
  if (result.status === "unavailable") return <p className="cms-alert is-warn">Vidensarkivet kan ikke kontaktes. Det siger ikke noget om, hvorvidt der findes tidligere materiale. Du kan fortsat gemme artiklen.</p>;
  return <div>
    <p className="cms-hint">Resultater for: {result.topic}</p>
    {result.status === "mock" && <p className="cms-alert is-warn">Demonstration — resultaterne er testdata, ikke redaktionens kilder.</p>}
    {result.evidence.length === 0 && <p className="cms-hint">Der blev ikke fundet tidligere materiale til denne søgning.</p>}
    {result.evidence.map((item) => <article className="cms-field" key={item.nodeId}>
      <strong>{item.source?.title ?? "Ingen kilde knyttet til resultatet"}</strong>
      <p>{item.text}</p>
      <p className="cms-hint">{item.origin === "derived" ? "AI-afledt materiale" : item.origin === "human" ? "Manuelt registreret materiale" : "Kildemateriale"} · Verificering: ukendt</p>
      <p className="cms-hint">Reference: {item.nodeId}{item.source ? ` · Kilde: ${item.source.id}` : ""}</p>
    </article>)}
    {result.contradictions.length > 0 && <section aria-label="Registrerede modsigelser">
      <h4>Registrerede modsigelser</h4>
      {result.contradictions.map((pair, index) => <p key={index}>{pair.claimA} / {pair.claimB}</p>)}
    </section>}
  </div>;
}

export function KnowledgePanel({ articleId, title }: { articleId: string | null; title: string }) {
  const inputId = useId();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ResearchResult | null>(null);
  const [error, setError] = useState("");
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);

  async function search() {
    const topic = (query || title).trim();
    if (topic.length < 2 || topic.length > 300) { setError("Angiv et emne på 2–300 tegn."); return; }
    pending.current?.abort();
    const controller = new AbortController(); pending.current = controller;
    setLoading(true); setError(""); setResult(null);
    try {
      const response = await fetch("/api/redaktion/knowledge/research", { method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: topic, ...(articleId ? { articleId } : {}) }),
        cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]) });
      const body = await response.json() as ResearchResponse;
      if (controller.signal.aborted) return;
      if (!response.ok || !body.ok) { setError(!body.ok ? body.error : "Research kunne ikke gennemføres."); return; }
      setResult(body.result);
    } catch {
      if (!controller.signal.aborted) setError("Research kunne ikke gennemføres. Du kan fortsat gemme artiklen.");
    } finally {
      if (!controller.signal.aborted) { setLoading(false); pending.current = null; }
    }
  }

  return <Accordion title="Tidligere viden" summary="Kilder og sammenhænge fra vidensarkivet">
    <div className="cms-field">
      <label className="cms-label" htmlFor={inputId}>Emne, person eller virksomhed</label>
      <input id={inputId} className="cms-input" value={query} placeholder={title || "Søg efter tidligere materiale"} maxLength={300}
        onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void search(); } }} />
      <button className="cms-btn cms-btn-secondary" type="button" disabled={loading} onClick={() => void search()}>{loading ? "Søger…" : "Find tidligere viden"}</button>
    </div>
    <div role="status" aria-live="polite" aria-busy={loading}>
      {loading && <p className="cms-hint">Henter tidligere materiale…</p>}
      {error && <p className="cms-alert is-warn">{error}</p>}
      {result && <KnowledgeResults result={result} />}
    </div>
  </Accordion>;
}
