"use client";

import { useDeferredValue, useId, useMemo, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { groundClaims, summarizeClaims } from "@/lib/engine/claims";
import { headlineChecks, readability } from "@/lib/engine/quality";
import { applyOverride, rateSource, sourceBasisChecks } from "@/lib/engine/source-rating";
import type { CopilotCtx, Derived, TabId } from "./copilot-types";
import { SearchTab } from "./tab-search";
import { FactsTab } from "./tab-facts";
import { QualityTab } from "./tab-quality";
import { SourcesTab } from "./tab-sources";
import { WriteTab } from "./tab-write";

const TABS: Array<{ id: TabId; label: string }> = [
  { id: "skriv", label: "Skriv" },
  { id: "kvalitet", label: "Kvalitet" },
  { id: "fakta", label: "Fakta" },
  { id: "kilder", label: "Kilder" },
  { id: "soeg", label: "Søg" },
];

function useDerived(ctx: CopilotCtx): Derived {
  const { titel, manchet, bodyText, kilder, profiles } = ctx;
  // Tung beregning på udskudt tekst, så skrivning aldrig hakker.
  const deferredBody = useDeferredValue(bodyText);
  const deferredTitle = useDeferredValue(titel);
  const deferredLead = useDeferredValue(manchet);
  return useMemo(() => {
    const claims = groundClaims(`${deferredTitle}\n\n${deferredLead}\n\n${deferredBody}`, kilder.map((k) => ({ titel: k.titel, uddrag: k.uddrag })));
    const ratings = kilder.map((k) => applyOverride(rateSource({ navn: k.udgiver || k.titel, url: k.url, sourceType: k.type }, profiles), k.rating));
    return {
      claims,
      claimCounts: summarizeClaims(claims),
      read: readability(deferredBody),
      headline: headlineChecks(deferredTitle),
      ratings,
      basis: sourceBasisChecks(ratings.map((r, i) => ({ grade: r.grade, hasExcerpt: Boolean(kilder[i].uddrag?.trim()), foelsom: r.foelsom }))),
      excerptCount: kilder.filter((k) => k.uddrag?.trim()).length,
    };
  }, [deferredBody, deferredTitle, deferredLead, kilder, profiles]);
}

export type IdleInfo = { canResearch: boolean; aiProvider: string | null };

/**
 * Højre felt i Production Engine. Med en åben historie (ctx) er der fem faner; uden kun søgning.
 * Alt her er forslag og kontrol: intet gemmes, mærkes eller publiceres uden redaktørens eget klik i editoren.
 */
export function EngineCopilot({ ctx, idle }: { ctx: CopilotCtx | null; idle?: IdleInfo }) {
  if (!ctx) return <IdleCopilot info={idle ?? { canResearch: false, aiProvider: null }} />;
  return <ActiveCopilot ctx={ctx} />;
}

function IdleCopilot({ info }: { info: IdleInfo }) {
  return (
    <div className="eng-copilot-inner">
      <section className="eng-card">
        <header className="eng-card-head">
          <h2 className="eng-card-title"><Sparkles size={16} aria-hidden="true" /> Copilot</h2>
        </header>
        <p className="cms-hint">Åbn eller start en historie for at få AI-forslag, kvalitetstjek, faktatjek mod originalkilder og kilderating. Du kan allerede nu søge i materialet.</p>
      </section>
      <SearchTab ctx={null} canResearch={info.canResearch} />
    </div>
  );
}

function ActiveCopilot({ ctx }: { ctx: CopilotCtx }) {
  const [tab, setTab] = useState<TabId>("skriv");
  const base = useId();
  const derived = useDerived(ctx);
  const refs = useRef<Partial<Record<TabId, HTMLButtonElement | null>>>({});

  function onKey(e: React.KeyboardEvent, index: number) {
    const next = e.key === "ArrowRight" ? index + 1 : e.key === "ArrowLeft" ? index - 1 : e.key === "Home" ? 0 : e.key === "End" ? TABS.length - 1 : null;
    if (next === null) return;
    e.preventDefault();
    const target = TABS[(next + TABS.length) % TABS.length].id;
    setTab(target);
    refs.current[target]?.focus();
  }

  const seo = ctx.score.score;
  const missing = derived.claimCounts.mangler;
  const basisBad = derived.basis.filter((b) => b.status === "fail").length;
  const chips: Array<{ id: TabId; label: string; tone: "ok" | "warn" | "bad" }> = [
    { id: "kvalitet", label: `SEO ${seo}`, tone: seo >= 80 ? "ok" : seo >= 50 ? "warn" : "bad" },
    { id: "kilder", label: `${ctx.kilder.length} ${ctx.kilder.length === 1 ? "kilde" : "kilder"}`, tone: basisBad > 0 ? "bad" : derived.basis.some((b) => b.status === "warn") ? "warn" : "ok" },
    { id: "fakta", label: derived.excerptCount === 0 ? "Fakta ikke kontrolleret" : missing > 0 ? `${missing} mangler dokumentation` : "Fakta dokumenteret", tone: derived.excerptCount === 0 ? "warn" : missing > 0 ? "bad" : "ok" },
  ];

  return (
    <div className="eng-copilot-inner">
      <section className="eng-card eng-copilot-head">
        <header className="eng-card-head">
          <h2 className="eng-card-title"><Sparkles size={16} aria-hidden="true" /> Copilot</h2>
          <span className={`eng-ai-pill${ctx.aiProvider ? "" : " is-off"}`} title={ctx.aiProvider ? "AI-udbyderen, der svarer på forslag" : "Der er ingen AI-nøgle sat på serveren"}>
            {ctx.aiProvider ? `AI: ${ctx.aiProvider}` : "AI ikke tilsluttet"}
          </span>
        </header>
        <ul className="eng-status" aria-label="Status for historien">
          {chips.map((c) => (
            <li key={c.id}>
              <button type="button" className={`eng-chip is-${c.tone}`} onClick={() => setTab(c.id)}>{c.label}</button>
            </li>
          ))}
        </ul>
        <div role="tablist" aria-label="Copilot" className="eng-tabs">
          {TABS.map((t, i) => (
            <button
              key={t.id}
              ref={(el) => { refs.current[t.id] = el; }}
              role="tab"
              type="button"
              id={`${base}-tab-${t.id}`}
              aria-selected={tab === t.id}
              aria-controls={`${base}-panel-${t.id}`}
              tabIndex={tab === t.id ? 0 : -1}
              className="eng-tab"
              onClick={() => setTab(t.id)}
              onKeyDown={(e) => onKey(e, i)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </section>
      <div role="tabpanel" id={`${base}-panel-${tab}`} aria-labelledby={`${base}-tab-${tab}`} className="eng-panel">
        {tab === "skriv" && <WriteTab ctx={ctx} />}
        {tab === "kvalitet" && <QualityTab ctx={ctx} derived={derived} />}
        {tab === "fakta" && <FactsTab ctx={ctx} derived={derived} goTo={setTab} />}
        {tab === "kilder" && <SourcesTab ctx={ctx} derived={derived} />}
        {tab === "soeg" && <SearchTab ctx={ctx} canResearch={Boolean(ctx.flags.canResearch)} />}
      </div>
    </div>
  );
}
