"use client";

import { TriangleAlert } from "lucide-react";
import { SuggestButton } from "@/components/editor/primitives";
import type { EditorialTask } from "@/lib/ai/editorial-schemas";
import type { CopilotCtx } from "./copilot-types";

const ACTIONS: Array<{ task: EditorialTask; label: string; hint: string }> = [
  { task: "headlines", label: "Rubrikker", hint: "3-5 forslag med begrundelse" },
  { task: "subheading", label: "Underrubrik", hint: "Uddyber rubrikken" },
  { task: "summary", label: "Resumé", hint: "Indsættes som faktaboks" },
  { task: "tagsGeo", label: "Tags og områder", hint: "Fra jeres egne lister" },
  { task: "seo", label: "SEO-tekster", hint: "Titel og metabeskrivelse" },
  { task: "og", label: "Delingstekster", hint: "Facebook, LinkedIn og X" },
  { task: "social", label: "Opslag til sociale medier", hint: "Én tekst pr. platform" },
  { task: "publishTime", label: "Udgivelsestid", hint: "Generelt råd, ikke målt data" },
];

/** Skriv: AI-forslag til rubrikker, tekster og metadata. Alt er forslag, og intet ændres, før du klikker Anvend. */
export function WriteTab({ ctx }: { ctx: CopilotCtx }) {
  const { ai } = ctx;
  return (
    <div className="eng-stack">
      {!ai.enabled && (
        <p className="eng-callout" role="note"><TriangleAlert size={16} aria-hidden="true" /> Din rolle har ikke adgang til AI-forslag.</p>
      )}
      {ctx.restricted && ai.enabled && (
        <p className="eng-callout" role="note"><TriangleAlert size={16} aria-hidden="true" /> Sektionen er spærret for AI-tekst (Krimi/Sundhed). Rubrikker, underrubrik og resumé er slået fra. Metadata og kvalitetstjek virker stadig.</p>
      )}
      <p className="cms-hint">Forslag gemmes ikke og mærkes først som AI-brug, når du anvender dem. Citater opfindes aldrig.</p>
      <ul className="eng-actions">
        {ACTIONS.map(({ task, label, hint }) => (
          <li key={task} className="eng-action">
            <div className="eng-action-row">
              <div>
                <strong>{label}</strong>
                <small className="cms-muted">{hint}</small>
              </div>
              <SuggestButton label="Foreslå" loading={ai.loading(task)} disabled={!ai.enabled} reason={ai.blocked(task)} onClick={() => ai.run(task)} />
            </div>
            {ai.tray(task)}
          </li>
        ))}
      </ul>
    </div>
  );
}
