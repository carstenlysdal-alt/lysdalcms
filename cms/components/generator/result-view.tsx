"use client";

import { AlertTriangle, Check } from "lucide-react";
import type { GenBlock, GenerationResult, GenSource } from "@/lib/generate/types";

const kmarks = (ids: string[]) => ids.map((id) => <span key={id} className="gen-k gen-k-sm">{id}</span>);

function Row({ block }: { block: GenBlock }) {
  if (block.type === "mellemrubrik") return <div className="gen-row"><span className="gen-margin" /><h4 className="gen-sub">{block.tekst}</h4></div>;
  if (block.type === "citat") {
    return (
      <div className="gen-row">
        <span className="gen-margin">{kmarks(block.kilder)}</span>
        <blockquote className="gen-quote"><p>»{block.tekst}«</p>{block.taler && <footer>{block.taler}</footer>}</blockquote>
      </div>
    );
  }
  if (block.type === "faktaboks") {
    return (
      <div className="gen-row">
        <span className="gen-margin">{kmarks(block.kilder)}</span>
        <aside className="gen-fact"><h4>{block.titel}</h4><p>{block.tekst}</p></aside>
      </div>
    );
  }
  return <div className="gen-row"><span className="gen-margin">{kmarks(block.kilder)}</span><p className="gen-p">{block.tekst}</p></div>;
}

/** Resultatet som korrektur: kildemærkerne står i marginen, og værnet viser, hvad der er fjernet eller mangler dokumentation. */
export function ResultView({ result, sources }: { result: GenerationResult; sources: readonly GenSource[] }) {
  const a = result.artikel;
  const removed = result.advarsler.filter((w) => w.niveau === "fjernet");
  const warnings = result.advarsler.filter((w) => w.niveau === "advarsel");
  const st = result.statistik;
  const used = new Set(a.brugteKilder);
  return (
    <div className="gen-result">
      <article className="gen-proof" aria-label="Genereret artikel">
        <header className="gen-proof-head">
          <h2 className="gen-proof-title">{a.titel}</h2>
          {a.manchet && <p className="gen-manchet">{a.manchet}</p>}
        </header>
        <div className="gen-body">{a.blokke.map((b, i) => <Row key={i} block={b} />)}</div>
      </article>

      <section className="gen-guard" aria-label="Værn og kontrol">
        <h3 className="gen-h3">Kontrol</h3>
        <dl className="gen-stats">
          <div><dt>Ord</dt><dd className="gen-num">{st.ord}</dd></div>
          <div><dt>Afsnit</dt><dd className="gen-num">{st.afsnit}</dd></div>
          <div><dt>Citater</dt><dd className="gen-num">{st.citater}</dd></div>
          <div><dt>Understøttet</dt><dd className="gen-num">{st.stoettet}</dd></div>
          <div><dt>Mangler</dt><dd className="gen-num">{st.mangler}</dd></div>
        </dl>
        {removed.length === 0 && warnings.length === 0 && <p className="gen-ok"><Check size={14} aria-hidden="true" /> Værnet fandt intet at bemærke. Kontrollér stadig alt mod originalerne.</p>}
        {removed.length > 0 && (
          <ul className="gen-flags" aria-label="Fjernet af værnet">
            {removed.map((w, i) => <li key={i} className="gen-flag is-removed"><span className="gen-flag-label">Fjernet</span><s>{w.tekst}</s></li>)}
          </ul>
        )}
        {warnings.length > 0 && (
          <ul className="gen-flags" aria-label="Tjek før udgivelse">
            {warnings.map((w, i) => <li key={i} className="gen-flag"><span className="gen-flag-label"><AlertTriangle size={12} aria-hidden="true" /> Tjek</span>{w.tekst}</li>)}
          </ul>
        )}
        {a.mangler.length > 0 && (
          <>
            <h4 className="gen-h4">Det savnede AI grundlag for</h4>
            <ul className="gen-todo">{a.mangler.map((m) => <li key={m}>{m}</li>)}</ul>
          </>
        )}
      </section>

      <section className="gen-meta-box" aria-label="Metadata">
        <h3 className="gen-h3">Metadata følger med kladden</h3>
        <dl className="gen-dl">
          <dt>SEO-titel</dt><dd>{a.seoTitel} <span className="gen-meta">({a.seoTitel.length}/60)</span></dd>
          <dt>Metabeskrivelse</dt><dd>{a.seoBeskrivelse} <span className="gen-meta">({a.seoBeskrivelse.length}/155)</span></dd>
          <dt>Adresse</dt><dd className="gen-mono">/{a.slug}</dd>
          <dt>Resumé</dt><dd>{a.tldr}</dd>
          <dt>Emner</dt><dd>{a.tags.length ? a.tags.join(", ") : "Ingen"}</dd>
          <dt>Områder</dt><dd>{a.omraader.length ? a.omraader.join(", ") : "Ingen"}</dd>
          {a.opslag.facebook && <><dt>Facebook</dt><dd>{a.opslag.facebook.tekst}{a.opslag.facebook.hashtags.length ? <span className="gen-meta"> {a.opslag.facebook.hashtags.map((h) => `#${h}`).join(" ")}</span> : null}</dd></>}
          {a.opslag.x && <><dt>X</dt><dd>{a.opslag.x.tekst}{a.opslag.x.hashtags.length ? <span className="gen-meta"> {a.opslag.x.hashtags.map((h) => `#${h}`).join(" ")}</span> : null}</dd></>}
          {a.billeder.length > 0 && <><dt>Billedforslag</dt><dd><ul className="gen-plain">{a.billeder.map((b, i) => <li key={i}>{kmarks([b.kilde])} {b.alt}{b.billedtekst ? ` · ${b.billedtekst}` : ""}</li>)}</ul></dd></>}
          <dt>Kilder brugt</dt><dd>{sources.filter((s) => used.has(s.id)).map((s) => `${s.id} ${s.titel}`).join(" · ") || "Ingen angivet"}</dd>
        </dl>
        <p className="gen-meta">Prompt {result.promptVersion}{result.modelId ? ` · model ${result.modelId}` : ""}</p>
      </section>
    </div>
  );
}
