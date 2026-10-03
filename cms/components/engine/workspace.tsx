"use client";

import { BookOpenText, PenLine, Radio } from "lucide-react";
import { EngineBusProvider, useEngineBus, type Pane } from "./engine-bus";

const PANES: Array<{ id: Pane; label: string; icon: React.ReactNode }> = [
  { id: "feed", label: "Signaler", icon: <Radio size={16} aria-hidden="true" /> },
  { id: "edit", label: "Skriv", icon: <PenLine size={16} aria-hidden="true" /> },
  { id: "copilot", label: "Copilot", icon: <BookOpenText size={16} aria-hidden="true" /> },
];

function Grid({ feed, children }: { feed: React.ReactNode; children: React.ReactNode }) {
  const { pane, showPane } = useEngineBus();
  return (
    <div className="cms-eng" data-pane={pane}>
      <nav className="eng-panes" aria-label="Arbejdsflade">
        {PANES.map((p) => (
          <button key={p.id} type="button" className="eng-pane-btn" aria-pressed={pane === p.id} onClick={() => showPane(p.id)}>{p.icon}{p.label}</button>
        ))}
      </nav>
      <aside className="eng-feed" aria-label="Signaler og feeds">{feed}</aside>
      {children}
    </div>
  );
}

/**
 * De tre felter. Fra 1100 px vises de side om side (signaler, skrivefladen, copilot); på mindre skærme én ad gangen
 * med en omskifter øverst. Selve editoren og copiloten kommer som children (editoren ejer artiklens tilstand).
 */
export function EngineWorkspace({ feed, initialPane, children }: { feed: React.ReactNode; initialPane: Pane; children: React.ReactNode }) {
  return (
    <EngineBusProvider initialPane={initialPane}>
      <Grid feed={feed}>{children}</Grid>
    </EngineBusProvider>
  );
}
