"use client";

import { useActionState, useState } from "react";
import { Plus } from "lucide-react";
import { Field, Notice } from "@/components/ui/Layout";
import { FEED_TYPE_LABEL, FEED_TYPES, PRIORITY_LABEL } from "@/lib/feeds/input";
import { SOURCE_TYPES } from "@/lib/ingest/schema";
import { TYPE_DEFAULTS } from "@/lib/engine/source-rating";
import { createFeedAction, updateFeedAction, type FeedFormState } from "./actions";
import type { FeedItemRow } from "./feed-types";

const INITIAL: FeedFormState = {};

export function Result({ state }: { state: FeedFormState }) {
  if (state.error) return <Notice tone="danger">{state.error}{state.detaljer && <ul className="kr-detail-list">{state.detaljer.map((d) => <li key={d}>{d}</li>)}</ul>}</Notice>;
  if (state.ok && state.besked) return <Notice tone="success">{state.besked}{state.detaljer && <ul className="kr-detail-list">{state.detaljer.map((d) => <li key={d}>{d}</li>)}</ul>}</Notice>;
  return null;
}

/** Opret eller redigér ét feed. En kladde (uden adresse) kan gemmes, men ikke slås til. */
export function FeedForm({ row, categories, onDone }: { row?: FeedItemRow; categories: string[]; onDone?: () => void }) {
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
        <Field label="Type" htmlFor={`ft-${uid}`} hint="CMS'et kan selv hente RSS/Atom og websider. API og mail hentes af agenten.">
          <select id={`ft-${uid}`} name="type" className="input" value={type} onChange={(e) => setType(e.target.value)} aria-describedby={`ft-${uid}-hint`}>
            {FEED_TYPES.map((t) => <option key={t} value={t}>{FEED_TYPE_LABEL[t]}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Adresse (URL)" htmlFor={`fu-${uid}`} hint={type === "mail" ? "Mail-feeds har ingen adresse." : "Skal være en http(s)-adresse. Kan stå tom, mens feedet er en kladde."}>
        <input id={`fu-${uid}`} name="url" className="input" type="url" defaultValue={row?.url ?? ""} placeholder="https://…" disabled={type === "mail"} aria-describedby={`fu-${uid}-hint`} />
      </Field>
      <div className="ui-form-grid">
        <Field label="Kategori" htmlFor={`fc-${uid}`} hint="Grupperer kilden i pakken, fx Politi, Kommune, Trafik.">
          <input id={`fc-${uid}`} name="kategori" className="input" list="kr-kategorier" defaultValue={row?.kategori ?? ""} maxLength={60} aria-describedby={`fc-${uid}-hint`} />
          <datalist id="kr-kategorier">{categories.map((c) => <option key={c} value={c} />)}</datalist>
        </Field>
        <Field label="Prioritet" htmlFor={`fp-${uid}`} hint="P0 er drift og breaking, P1 er historiekilder, P2 er opdagelse.">
          <select id={`fp-${uid}`} name="prioritet" className="input" defaultValue={String(row?.prioritet ?? 2)} aria-describedby={`fp-${uid}-hint`}>
            {[1, 2, 3].map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}
          </select>
        </Field>
      </div>
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
        <Field label="Interval (minutter)" htmlFor={`fm-${uid}`} hint="Vejledende for agenten. Mellem 5 og 1440."><input id={`fm-${uid}`} name="intervalMin" className="input" type="number" min={5} max={1440} step={1} defaultValue={row?.intervalMin ?? 30} aria-describedby={`fm-${uid}-hint`} /></Field>
        <Field label="Noter" htmlFor={`fx-${uid}`}><input id={`fx-${uid}`} name="noter" className="input" defaultValue={row?.noter ?? ""} maxLength={300} /></Field>
      </div>
      <label className="check-row"><input type="checkbox" name="aktiv" defaultChecked={row?.aktiv ?? true} /> Aktiv (kan hentes, og agenten ser feedet)</label>
      <div className="ui-actions"><button type="submit" className="btn btn-primary" disabled={pending}>{row ? "Gem ændringer" : <><Plus size={16} aria-hidden="true" /> Tilføj feed</>}</button></div>
      <Result state={state} />
    </form>
  );
}
