"use client";

import { useActionState, useMemo, useState } from "react";
import { History, RotateCcw, Save } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Field, Notice } from "@/components/ui/Layout";
import { composeInstruction, composeSystem, CUSTOM_NOTE, STYLE_KEY } from "@/lib/prompts/compose";
import { diffLines, diffStats } from "@/lib/prompts/diff";
import { restorePromptAction, resetPromptAction, savePromptAction, type PromptFormState } from "./actions";

export type EditorDef = {
  noegle: string;
  titel: string;
  beskrivelse: string;
  standard: string;
  laast: string | null;
  laastTitel: string;
  minTegn: number;
  maxTegn: number;
  eksempel: string | null;
  opgave: string | null;
  kind: string;
};
export type EditorHistory = { version: number; indhold: string; note: string | null; af: string | null; tid: string; tidLabel: string };

const INITIAL: PromptFormState = {};

function Result({ state }: { state: PromptFormState }) {
  if (state.error) return <Notice tone="danger" title={state.konflikt ? "Konflikt" : "Kunne ikke gemme"}>{state.error}</Notice>;
  if (state.ok && state.besked) return <Notice tone="success">{state.besked}</Notice>;
  return null;
}

/** Redigér én prompt: tekst, forskel mod standard, hvad modellen faktisk får, og historik. Låste dele vises skrivebeskyttet. */
export function PromptEditor({ def, tilpasset, version, current, history }: { def: EditorDef; tilpasset: boolean; version: number; current: string; history: EditorHistory[] }) {
  const [saveState, saveAction, saving] = useActionState(savePromptAction, INITIAL);
  const [resetState, resetAction, resetting] = useActionState(resetPromptAction, INITIAL);
  const [restoreState, restoreAction, restoring] = useActionState(restorePromptAction, INITIAL);
  const [text, setText] = useState(current);

  const diff = useMemo(() => diffLines(def.standard, text), [def.standard, text]);
  const stats = diffStats(diff);
  const same = text.trim() === def.standard.trim();
  const preview = useMemo(() => {
    // Uændret tekst = ren standard: intet "tilpasset"-mærke i det modellen får.
    const overrides = same ? {} : { [def.noegle]: text };
    if (def.noegle === STYLE_KEY || def.kind === "grundlag") return composeSystem(overrides);
    if (def.opgave) {
      const c = composeInstruction(def.opgave, overrides);
      return `OPGAVE (${def.opgave}, v${c.version}): ${c.instruction}\n\nSVARFORMAT (kun JSON): ${c.shape}`;
    }
    // Tillægslag: vis lagets tekst, som det tilføjes til opgaverne
    return text.trim() ? `${text.trim()}\n\n${CUSTOM_NOTE}` : "(Laget er tomt og tilføjer ingenting.)";
  }, [def, text, same]);
  const busy = saving || resetting || restoring;

  return (
    <div className="kr-editor">
      <div className="kr-editor-main">
        <Card title={def.titel} description={def.beskrivelse} actions={<Badge tone={tilpasset ? "primary" : "neutral"} dot>{tilpasset ? `Tilpasset · version ${version}` : "Standard"}</Badge>}>
          <form action={saveAction} className="ui-stack ui-gap-md">
            <input type="hidden" name="noegle" value={def.noegle} />
            <input type="hidden" name="baseVersion" value={version} />
            <Field label="Tekst" htmlFor="indhold" hint={`${text.trim().length} af ${def.maxTegn} tegn${def.minTegn ? ` (mindst ${def.minTegn})` : ""}. Tilretninger gælder for hele byen fra næste AI-kald.`}>
              <textarea id="indhold" name="indhold" className="input kr-textarea" rows={def.maxTegn > 2000 ? 14 : 10} value={text} maxLength={def.maxTegn + 200} onChange={(e) => setText(e.target.value)} aria-describedby="indhold-hint" />
            </Field>
            <Field label="Note til historikken (valgfri)" htmlFor="note" hint="Fortæl kort, hvorfor du ændrer den.">
              <input id="note" name="note" className="input" maxLength={200} />
            </Field>
            <div className="ui-actions">
              <button type="submit" className="btn btn-primary" disabled={busy || same}><Save size={16} aria-hidden="true" /> {saving ? "Gemmer…" : "Gem som ny version"}</button>
              {def.eksempel && text.trim() === "" && <button type="button" className="btn btn-secondary" onClick={() => setText(def.eksempel ?? "")}>Indsæt forslag</button>}
              {text !== def.standard && <button type="button" className="btn btn-secondary" onClick={() => setText(def.standard)}>Genindsæt standardtekst</button>}
            </div>
            <Result state={saveState} />
          </form>
          {tilpasset && (
            <form action={resetAction} className="kr-reset">
              <input type="hidden" name="noegle" value={def.noegle} />
              <input type="hidden" name="baseVersion" value={version} />
              <button type="submit" className="btn btn-secondary" disabled={busy}><RotateCcw size={16} aria-hidden="true" /> {resetting ? "Nulstiller…" : "Nulstil til standard"}</button>
              <Result state={resetState} />
            </form>
          )}
        </Card>

        <Card title="Forskel fra standard" description={same ? "Teksten er identisk med standarden." : `${stats.added} linjer tilføjet, ${stats.removed} fjernet.`}>
          <pre className="kr-diff" aria-label="Forskel fra standardteksten">
            {diff.map((l, i) => (
              <span key={i} className={`kr-diff-line is-${l.kind}`}>
                <span className="kr-diff-mark" aria-hidden="true">{l.kind === "add" ? "+" : l.kind === "del" ? "−" : " "}</span>
                <span className="cms-sr-only">{l.kind === "add" ? "Tilføjet: " : l.kind === "del" ? "Fjernet: " : ""}</span>
                {l.text || " "}
                {"\n"}
              </span>
            ))}
          </pre>
        </Card>

        <Card title="Sådan ser modellen den" description="Det samlede resultat, når din tekst er sat sammen med de låste dele.">
          <pre className="kr-pre">{preview}</pre>
        </Card>

        {def.laast && (
          <Card title={def.laastTitel} description="Låst i koden og kan ikke ændres her. Svar valideres mod denne form, og sikkerhedsreglerne gælder altid." tone="muted">
            <pre className="kr-pre">{def.laast}</pre>
          </Card>
        )}
      </div>

      <aside className="kr-editor-side" aria-label="Historik">
        <Card title="Historik" icon={<History size={16} />} description="Hver gemt version bevares. Gendan en ældre version, hvis en ændring ikke virkede.">
          {history.length === 0 ? (
            <p className="ui-section-text">Ingen ændringer endnu: standardteksten gælder.</p>
          ) : (
            <ol className="kr-history">
              {history.map((h) => (
                <li key={h.version} className="kr-history-item">
                  <div className="kr-history-head">
                    <strong>Version {h.version}</strong>
                    {h.version === version && tilpasset && <Badge tone="success" dot>Gælder</Badge>}
                  </div>
                  <p className="kr-history-meta"><time dateTime={h.tid}>{h.tidLabel}</time>{h.af ? ` · ${h.af}` : ""}</p>
                  {h.note && <p className="kr-history-note">{h.note}</p>}
                  <details>
                    <summary>Vis tekst</summary>
                    <pre className="kr-pre">{h.indhold}</pre>
                  </details>
                  <form action={restoreAction}>
                    <input type="hidden" name="noegle" value={def.noegle} />
                    <input type="hidden" name="version" value={h.version} />
                    <input type="hidden" name="baseVersion" value={version} />
                    <button type="submit" className="btn btn-secondary btn-sm" disabled={busy}>Gendan denne version</button>
                  </form>
                </li>
              ))}
            </ol>
          )}
          <Result state={restoreState} />
        </Card>
      </aside>
    </div>
  );
}
