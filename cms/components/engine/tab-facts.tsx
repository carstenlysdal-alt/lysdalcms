"use client";

import { Check, CircleAlert, CircleHelp } from "lucide-react";
import { SuggestButton } from "@/components/editor/primitives";
import type { ClaimCheck, ClaimKind, ClaimStatus } from "@/lib/engine/claims";
import type { CopilotCtx, Derived, TabId } from "./copilot-types";

const KIND: Record<ClaimKind, string> = { tal: "Tal", tid: "Tidspunkt", citat: "Citat" };
const GROUPS: Array<{ status: ClaimStatus; title: string; icon: React.ReactNode }> = [
  { status: "mangler", title: "Mangler dokumentation", icon: <CircleAlert size={14} aria-hidden="true" /> },
  { status: "stoettet", title: "Står i kilden", icon: <Check size={14} aria-hidden="true" /> },
  { status: "ukontrolleret", title: "Ikke kontrolleret", icon: <CircleHelp size={14} aria-hidden="true" /> },
];

function ClaimRow({ claim, sourceTitle }: { claim: ClaimCheck; sourceTitle: string | null }) {
  return (
    <li className={`eng-claim is-${claim.status}`}>
      <div className="eng-claim-head">
        <span className="eng-kind">{KIND[claim.kind]}</span>
        <q className="eng-claim-text">{claim.tekst}</q>
      </div>
      <small className="cms-muted">{claim.note}{sourceTitle ? ` (${sourceTitle})` : ""}</small>
    </li>
  );
}

/**
 * Fakta: tal, tidspunkter og citater i artiklen kontrolleres mod UDDRAG fra originalkilderne (deterministisk, uden AI).
 * AI-faktatjekket lægges ovenpå og bruger de samme uddrag. "Står i kilden" betyder, at ordlyden findes dér, ikke at kilden har ret.
 */
export function FactsTab({ ctx, derived, goTo }: { ctx: CopilotCtx; derived: Derived; goTo: (tab: TabId) => void }) {
  const { claims, claimCounts: c, excerptCount } = derived;
  const hasSources = ctx.kilder.some((k) => k.titel.trim());
  return (
    <div className="eng-stack">
      <section className="eng-card" aria-labelledby="eng-fact-h">
        <header className="eng-card-head"><h3 id="eng-fact-h" className="eng-card-title">Kontrol mod originalerne</h3></header>
        {excerptCount === 0 ? (
          <p className="eng-callout" role="note">
            <span>
              Ingen af kilderne har et uddrag, så tal og citater kan ikke kontrolleres mod originalen.{" "}
              <button type="button" className="cms-link-btn" onClick={() => goTo("kilder")}>Indlæg originalen under Kilder</button>
            </span>
          </p>
        ) : (
          <p className="eng-tally" aria-live="polite">
            <span className="eng-tally-bad"><strong>{c.mangler}</strong> mangler</span>
            <span className="eng-tally-ok"><strong>{c.stoettet}</strong> i kilden</span>
            <span><strong>{c.ukontrolleret}</strong> ikke kontrolleret</span>
          </p>
        )}
        {claims.length === 0 && <p className="cms-muted">Ingen tal, tidspunkter eller citater at kontrollere endnu.</p>}
        {GROUPS.map((g) => {
          const rows = claims.filter((x) => x.status === g.status);
          if (rows.length === 0) return null;
          return (
            <div key={g.status} className="eng-group">
              <h4 className="eng-group-title">{g.icon} {g.title} <span className="cms-muted">({rows.length})</span></h4>
              <ul className="eng-claims">
                {rows.map((claim) => <ClaimRow key={claim.id} claim={claim} sourceTitle={claim.kilde ? ctx.kilder[claim.kilde - 1]?.titel ?? null : null} />)}
              </ul>
            </div>
          );
        })}
        <p className="cms-hint">Kontrollen finder tal, klokkeslæt og citater. Navne og påstande kontrolleres af AI-faktatjekket herunder og af dig.</p>
      </section>

      <section className="eng-card" aria-labelledby="eng-aifact-h">
        <header className="eng-card-head"><h3 id="eng-aifact-h" className="eng-card-title">Faktatjek med AI</h3></header>
        <p className="cms-hint">AI sammenholder udsagn med dine kilder og deres uddrag. En kilde uden uddrag kan aldrig give grøn.</p>
        <div className="eng-row-actions">
          <SuggestButton label="Faktatjek mod kilder" loading={ctx.ai.loading("factcheck")} disabled={!ctx.ai.enabled} reason={ctx.ai.blocked("factcheck") ?? (hasSources ? null : "Tilføj mindst én kilde under Kilder.")} onClick={() => ctx.ai.run("factcheck")} />
        </div>
        {ctx.ai.tray("factcheck")}
      </section>
    </div>
  );
}
