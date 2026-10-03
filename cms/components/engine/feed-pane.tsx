import Link from "next/link";
import { Radio, Search } from "lucide-react";
import type { EngineTab, FeedData } from "@/lib/engine/types";
import { FeedCardView } from "./feed-card";

export type EngineQuery = { tab: EngineTab; omraade: string; q: string; id: string };

/** Bygger en lænke til Production Engine med de valgte filtre (tom værdi udelades). */
export function engineHref(base: EngineQuery, patch: Partial<EngineQuery> = {}): string {
  const v = { ...base, ...patch };
  const p = new URLSearchParams();
  if (v.tab !== "feeds") p.set("tab", v.tab);
  if (v.omraade) p.set("omraade", v.omraade);
  if (v.q) p.set("q", v.q);
  if (v.id) p.set("id", v.id);
  const s = p.toString();
  return `/redaktion/engine${s ? `?${s}` : ""}`;
}

const EMPTY: Record<EngineTab, { title: string; text: string }> = {
  feeds: { title: "Ingen signaler", text: "Der er ikke indsamlet signaler endnu for dette valg. De kommer ind via agenterne (se Kontrolrum › Ingest) eller kan tilføjes under Signaler." },
  tips: { title: "Ingen åbne tip", text: "Nye borgertip og meddelersager vises her, så snart de kommer ind." },
  arkiv: { title: "Intet at vise", text: "Åbn en historie, eller søg efter et emne for at finde tidligere dækning med samme nøgleord." },
};

/** Venstre felt: signaler, tip og arkiv. Server-komponent; kortene er klient-komponenter. */
export function FeedPane({ data, query, canWrite }: { data: FeedData; query: EngineQuery; canWrite: boolean }) {
  const { counts, omraader } = data;
  const tabs: Array<{ id: EngineTab; label: string; count?: number }> = [
    { id: "feeds", label: "Signaler", count: counts.ulaeste || undefined },
    { id: "tips", label: "Tip", count: counts.tips || undefined },
    { id: "arkiv", label: "Arkiv" },
  ];
  const live = data.sync.maskin24t > 0;
  return (
    <div className="eng-feed-inner">
      <section className="eng-card eng-feed-head" aria-labelledby="eng-feed-h">
        <header className="eng-card-head">
          <h2 id="eng-feed-h" className="eng-card-title"><Radio size={16} aria-hidden="true" /> Signaler og feeds</h2>
          <span className={`eng-live${live ? " is-live" : ""}`} title={live ? `${data.sync.maskin24t} maskinindsamlede signaler seneste døgn` : "Ingen maskinindsamlede signaler seneste døgn"}>
            <span className="eng-live-dot" aria-hidden="true" />{live ? "Live" : "Stille"}
          </span>
        </header>
        <nav className="eng-tabs" aria-label="Visning">
          {tabs.map((t) => (
            <Link key={t.id} className="eng-tab" href={engineHref(query, { tab: t.id })} scroll={false} prefetch={false} aria-current={query.tab === t.id ? "page" : undefined}>
              {t.label}{t.count ? <span className="eng-count">{t.count}<span className="cms-sr-only"> nye</span></span> : null}
            </Link>
          ))}
        </nav>
        {query.tab !== "arkiv" && omraader.length > 0 && (
          <nav className="eng-areas" aria-label="Område">
            <Link className="eng-area" href={engineHref(query, { omraade: "" })} scroll={false} prefetch={false} aria-current={!query.omraade ? "page" : undefined}>Alle</Link>
            {omraader.map((o) => <Link key={o.slug} className="eng-area" href={engineHref(query, { omraade: o.slug })} scroll={false} prefetch={false} aria-current={query.omraade === o.slug ? "page" : undefined}>{o.navn}</Link>)}
          </nav>
        )}
        {query.tab === "arkiv" && (
          <form className="eng-search" action="/redaktion/engine" method="get" role="search">
            {query.id && <input type="hidden" name="id" value={query.id} />}
            <input type="hidden" name="tab" value="arkiv" />
            <label className="cms-sr-only" htmlFor="eng-arkiv-q">Find tidligere dækning</label>
            <input id="eng-arkiv-q" className="cms-input" name="q" defaultValue={query.q} placeholder="Emne, sted eller navn" maxLength={200} />
            <button className="cms-btn cms-btn-secondary" type="submit"><Search size={14} aria-hidden="true" /> Find</button>
          </form>
        )}
        {data.sync.sidsteMaskinSignalIso === null && query.tab === "feeds" && <p className="cms-hint">Ingen agent har leveret signaler endnu. Opret en nøgle under Kontrolrum › Ingest.</p>}
      </section>

      {data.cards.length === 0 ? (
        <section className="eng-card"><h3 className="eng-card-title">{EMPTY[query.tab].title}</h3><p className="cms-hint">{EMPTY[query.tab].text}</p></section>
      ) : (
        <ul className="eng-items" aria-label="Kort">
          {data.cards.map((card) => <li key={card.id}><FeedCardView card={card} canWrite={canWrite} /></li>)}
        </ul>
      )}
    </div>
  );
}
