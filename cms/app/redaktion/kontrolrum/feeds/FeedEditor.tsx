"use client";

import { useActionState, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Field, Notice } from "@/components/ui/Layout";
import { FEED_TYPE_LABEL, FEED_TYPES } from "@/lib/feeds/input";
import { SOURCE_TYPES } from "@/lib/ingest/schema";
import { TYPE_DEFAULTS } from "@/lib/engine/source-rating";
import { createFeedAction, deleteFeedAction, updateFeedAction, type FeedFormState } from "./actions";

export type FeedItemRow = { id: string; navn: string; type: string; url: string | null; sourceType: string | null; omraadeTekst: string | null; inkluder: string[]; ekskluder: string[]; intervalMin: number; aktiv: boolean; noter: string | null };
const INITIAL: FeedFormState = {};

function Result({ state }: { state: FeedFormState }) {
  if (state.error) return <Notice tone="danger">{state.error}</Notice>;
  if (state.ok && state.besked) return <Notice tone="success">{state.besked}</Notice>;
  return null;
}

function FeedForm({ row, onDone }: { row?: FeedItemRow; onDone?: () => void }) {
  const [state, action, pending] = useActionState(async (prev: FeedFormState, fd: FormData) => {
    const res = await (row ? updateFeedAction(prev, fd) : createFeedAction(prev, fd));
    if (res.ok) onDone?.();
    return res;
  }, INITIAL);
  const [type, setType] = useState(row?.type ?? "rss");
  const uid = row?.id ?? "ny";
  return (
    <form action={action} className="ui-stack ui-gap-md" key={state.ok ? "done" : "open"}>
      {row && <input type="hidden" name="id" value={row.id} />}
      <div className="ui-form-grid">
        <Field label="Navn" htmlFor={`fn-${uid}`} required><input id={`fn-${uid}`} name="navn" className="input" defaultValue={row?.navn ?? ""} maxLength={80} required /></Field>
        <Field label="Type" htmlFor={`ft-${uid}`}>
          <select id={`ft-${uid}`} name="type" className="input" value={type} onChange={(e) => setType(e.target.value)}>
            {FEED_TYPES.map((t) => <option key={t} value={t}>{FEED_TYPE_LABEL[t]}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Adresse (URL)" htmlFor={`fu-${uid}`} required={type !== "mail"} hint={type === "mail" ? "Mail-feeds har ingen adresse." : "Skal være en http(s)-adresse."}>
        <input id={`fu-${uid}`} name="url" className="input" type="url" defaultValue={row?.url ?? ""} placeholder="https://…" disabled={type === "mail"} aria-describedby={`fu-${uid}-hint`} />
      </Field>
      <div className="ui-form-grid">
        <Field label="Kildetype" htmlFor={`fk-${uid}`} hint="Styrer ratingen af signaler fra feedet.">
          <select id={`fk-${uid}`} name="sourceType" className="input" defaultValue={row?.sourceType ?? ""} aria-describedby={`fk-${uid}-hint`}>
            <option value="">Ukendt</option>
            {SOURCE_TYPES.map((t) => <option key={t} value={t}>{TYPE_DEFAULTS[t]?.label ?? t}</option>)}
          </select>
        </Field>
        <Field label="Område (hint)" htmlFor={`fo-${uid}`} hint="Fx Næstved. Bruges til at placere signalerne."><input id={`fo-${uid}`} name="omraadeTekst" className="input" defaultValue={row?.omraadeTekst ?? ""} maxLength={120} aria-describedby={`fo-${uid}-hint`} /></Field>
      </div>
      <div className="ui-form-grid">
        <Field label="Skal indeholde et af ordene" htmlFor={`fi-${uid}`} hint="Adskilt med komma eller linjeskift. Tom = alt."><textarea id={`fi-${uid}`} name="inkluder" className="input" rows={2} defaultValue={row?.inkluder.join(", ") ?? ""} aria-describedby={`fi-${uid}-hint`} /></Field>
        <Field label="Må ikke indeholde" htmlFor={`fe-${uid}`} hint="Signaler med disse ord fravælges."><textarea id={`fe-${uid}`} name="ekskluder" className="input" rows={2} defaultValue={row?.ekskluder.join(", ") ?? ""} aria-describedby={`fe-${uid}-hint`} /></Field>
      </div>
      <div className="ui-form-grid">
        <Field label="Interval (minutter)" htmlFor={`fm-${uid}`} hint="Mellem 5 og 1440."><input id={`fm-${uid}`} name="intervalMin" className="input" type="number" min={5} max={1440} step={1} defaultValue={row?.intervalMin ?? 30} aria-describedby={`fm-${uid}-hint`} /></Field>
        <Field label="Noter" htmlFor={`fx-${uid}`}><input id={`fx-${uid}`} name="noter" className="input" defaultValue={row?.noter ?? ""} maxLength={300} /></Field>
      </div>
      <label className="check-row"><input type="checkbox" name="aktiv" defaultChecked={row?.aktiv ?? true} /> Aktiv (agenten henter feedet)</label>
      <div className="ui-actions"><button type="submit" className="btn btn-primary" disabled={pending}>{row ? "Gem ændringer" : <><Plus size={16} aria-hidden="true" /> Tilføj feed</>}</button></div>
      <Result state={state} />
    </form>
  );
}

function FeedItem({ row }: { row: FeedItemRow }) {
  const [open, setOpen] = useState(false);
  const [delState, delAction, deleting] = useActionState(deleteFeedAction, INITIAL);
  return (
    <li className={`kr-source${row.aktiv ? "" : " is-off"}`}>
      <div className="kr-source-head">
        <div className="kr-source-main">
          <strong>{row.navn}</strong>
          <span className="kr-muted">{FEED_TYPE_LABEL[row.type as keyof typeof FEED_TYPE_LABEL] ?? row.type} · hvert {row.intervalMin}. minut{row.omraadeTekst ? ` · ${row.omraadeTekst}` : ""}</span>
          {row.url && <span className="kr-source-note">{row.url}</span>}
          {(row.inkluder.length > 0 || row.ekskluder.length > 0) && <span className="kr-source-note">{row.inkluder.length > 0 ? `Med: ${row.inkluder.join(", ")}` : ""}{row.inkluder.length > 0 && row.ekskluder.length > 0 ? " · " : ""}{row.ekskluder.length > 0 ? `Uden: ${row.ekskluder.join(", ")}` : ""}</span>}
        </div>
        <Badge tone={row.aktiv ? "success" : "neutral"} dot>{row.aktiv ? "Aktiv" : "Slukket"}</Badge>
        <button type="button" className="btn btn-secondary btn-sm" aria-expanded={open} onClick={() => setOpen((v) => !v)}>{open ? "Luk" : "Redigér"}</button>
      </div>
      {open && (
        <div className="kr-source-edit">
          <FeedForm row={row} onDone={() => setOpen(false)} />
          <form action={delAction}>
            <input type="hidden" name="id" value={row.id} />
            <button type="submit" className="btn btn-danger btn-sm" disabled={deleting}><Trash2 size={14} aria-hidden="true" /> Fjern feed</button>
            <Result state={delState} />
          </form>
        </div>
      )}
    </li>
  );
}

export function FeedEditor({ rows }: { rows: FeedItemRow[] }) {
  return (
    <div className="ui-stack ui-gap-lg">
      <Card title={`Feeds (${rows.length})`} description="Det, agenterne skal overvåge. De henter listen med GET /api/ingest/feeds og leverer signaler tilbage via POST /api/ingest/signals.">
        {rows.length === 0 ? <p className="ui-section-text">Ingen feeds endnu. Tilføj det første herunder.</p> : <ul className="kr-sources">{rows.map((r) => <FeedItem key={r.id} row={r} />)}</ul>}
      </Card>
      <Card title="Tilføj feed"><FeedForm /></Card>
    </div>
  );
}
