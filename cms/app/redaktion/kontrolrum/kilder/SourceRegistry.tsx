"use client";

import { useActionState, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { GradeBadge } from "@/components/engine/rating-badge";
import { Card } from "@/components/ui/Card";
import { Field, Notice } from "@/components/ui/Layout";
import { GRADE_BANDS, GRADE_INFO, gradeFromScore, rateSource, TYPE_DEFAULTS, type SourceProfileLite } from "@/lib/engine/source-rating";
import { createSourceAction, deleteSourceAction, importDefaultsAction, updateSourceAction, type SourceFormState } from "./actions";

export type ProfileRow = { id: string; navn: string; type: string; domaene: string | null; score: number; note: string | null; aktiv: boolean };
const INITIAL: SourceFormState = {};
const TYPES = Object.entries(TYPE_DEFAULTS).map(([value, v]) => ({ value, label: v.label, score: v.score }));

function Result({ state }: { state: SourceFormState }) {
  if (state.error) return <Notice tone="danger">{state.error}</Notice>;
  if (state.ok && state.besked) return <Notice tone="success">{state.besked}</Notice>;
  return null;
}

function ScoreField({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
  const n = Number(value);
  const valid = value.trim() !== "" && Number.isInteger(n) && n >= 0 && n <= 100;
  return (
    <Field label="Score (0-100)" htmlFor={id} hint={`A fra ${GRADE_BANDS.A}, B fra ${GRADE_BANDS.B}, C fra ${GRADE_BANDS.C}, ellers D.`}>
      <div className="kr-score">
        <input id={id} name="score" className="input" type="number" inputMode="numeric" min={0} max={100} step={1} value={value} onChange={(e) => onChange(e.target.value)} aria-describedby={`${id}-hint`} required />
        {valid ? <GradeBadge grade={gradeFromScore(n)} score={n} /> : <span className="kr-muted">Angiv 0-100</span>}
      </div>
    </Field>
  );
}

function ProfileForm({ row, onDone }: { row?: ProfileRow; onDone?: () => void }) {
  const [state, action, pending] = useActionState(async (prev: SourceFormState, fd: FormData) => {
    const res = await (row ? updateSourceAction(prev, fd) : createSourceAction(prev, fd));
    if (res.ok) onDone?.();
    return res;
  }, INITIAL);
  const [score, setScore] = useState(String(row?.score ?? 50));
  const [type, setType] = useState(row?.type ?? "andet");
  const uid = row?.id ?? "ny";
  return (
    <form action={action} className="ui-stack ui-gap-md" key={state.ok ? "done" : "open"}>
      {row && <input type="hidden" name="id" value={row.id} />}
      <div className="ui-form-grid">
        <Field label="Navn" htmlFor={`navn-${uid}`} required><input id={`navn-${uid}`} name="navn" className="input" defaultValue={row?.navn ?? ""} maxLength={80} required /></Field>
        <Field label="Domæne" htmlFor={`dom-${uid}`} hint="Fx politi.dk. Underdomæner (slagelse.kommune.dk) rammes også."><input id={`dom-${uid}`} name="domaene" className="input" defaultValue={row?.domaene ?? ""} placeholder="politi.dk" aria-describedby={`dom-${uid}-hint`} /></Field>
      </div>
      <div className="ui-form-grid">
        <Field label="Kildetype" htmlFor={`type-${uid}`} hint={`Standardscore for typen: ${TYPE_DEFAULTS[type]?.score ?? "?"}.`}>
          <select id={`type-${uid}`} name="type" className="input" value={type} onChange={(e) => setType(e.target.value)} aria-describedby={`type-${uid}-hint`}>
            {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </Field>
        <ScoreField id={`score-${uid}`} value={score} onChange={setScore} />
      </div>
      <Field label="Note (valgfri)" htmlFor={`note-${uid}`} hint="Vises til redaktøren ved ratingen, fx hvorfor kilden er rated, som den er."><input id={`note-${uid}`} name="note" className="input" defaultValue={row?.note ?? ""} maxLength={240} aria-describedby={`note-${uid}-hint`} /></Field>
      <label className="check-row"><input type="checkbox" name="aktiv" defaultChecked={row?.aktiv ?? true} /> Aktiv (bruges ved rating)</label>
      <div className="ui-actions">
        <button type="submit" className="btn btn-primary" disabled={pending}>{row ? "Gem ændringer" : <><Plus size={16} aria-hidden="true" /> Tilføj kilde</>}</button>
      </div>
      <Result state={state} />
    </form>
  );
}

function ProfileItem({ row }: { row: ProfileRow }) {
  const [open, setOpen] = useState(false);
  const [delState, delAction, deleting] = useActionState(deleteSourceAction, INITIAL);
  return (
    <li className={`kr-source${row.aktiv ? "" : " is-off"}`}>
      <div className="kr-source-head">
        <div className="kr-source-main">
          <strong>{row.navn}</strong>
          <span className="kr-muted">{TYPE_DEFAULTS[row.type]?.label ?? row.type}{row.domaene ? ` · ${row.domaene}` : ""}{row.aktiv ? "" : " · inaktiv"}</span>
          {row.note && <span className="kr-source-note">{row.note}</span>}
        </div>
        <GradeBadge grade={gradeFromScore(row.score)} score={row.score} />
        <span className="kr-source-score">{row.score}</span>
        <button type="button" className="btn btn-secondary btn-sm" aria-expanded={open} onClick={() => setOpen((v) => !v)}>{open ? "Luk" : "Redigér"}</button>
      </div>
      {open && (
        <div className="kr-source-edit">
          <ProfileForm row={row} onDone={() => setOpen(false)} />
          <form action={delAction}>
            <input type="hidden" name="id" value={row.id} />
            <button type="submit" className="btn btn-danger btn-sm" disabled={deleting}><Trash2 size={14} aria-hidden="true" /> Fjern kilde</button>
            <Result state={delState} />
          </form>
        </div>
      )}
    </li>
  );
}

/** Prøv ratingen: hvilken karakter ville en kilde få med det nuværende register? Rører ingen data. */
function Tester({ profiles }: { profiles: SourceProfileLite[] }) {
  const [navn, setNavn] = useState("");
  const [url, setUrl] = useState("");
  const [type, setType] = useState("");
  const result = useMemo(() => (navn.trim() || url.trim() || type ? rateSource({ navn, url, sourceType: type || null }, profiles) : null), [navn, url, type, profiles]);
  return (
    <Card title="Prøv ratingen" description="Se, hvilken karakter en kilde ville få lige nu. Intet gemmes.">
      <div className="ui-form-grid">
        <Field label="Navn" htmlFor="t-navn"><input id="t-navn" className="input" value={navn} onChange={(e) => setNavn(e.target.value)} placeholder="Ritzau" /></Field>
        <Field label="URL" htmlFor="t-url"><input id="t-url" className="input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.politi.dk/…" /></Field>
        <Field label="Kildetype" htmlFor="t-type">
          <select id="t-type" className="input" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">Ukendt</option>
            {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </Field>
      </div>
      {result ? (
        <div className="kr-test-result" role="status" aria-live="polite">
          <GradeBadge grade={result.grade} score={result.score} />
          <p><strong>{result.label}</strong> · score {result.score}. {result.begrundelse}</p>
          <p className="kr-muted">{GRADE_INFO[result.grade].kraever}{result.foelsom ? " Kan indeholde personoplysninger." : ""}</p>
        </div>
      ) : <p className="kr-muted">Udfyld et felt for at se ratingen.</p>}
    </Card>
  );
}

export function SourceRegistry({ rows }: { rows: ProfileRow[] }) {
  const [importState, importAction, importing] = useActionState(importDefaultsAction, INITIAL);
  const lite: SourceProfileLite[] = rows.map((r) => ({ navn: r.navn, type: r.type, domaene: r.domaene, score: r.score, note: r.note, aktiv: r.aktiv }));
  return (
    <div className="ui-stack ui-gap-lg">
      <Tester profiles={lite} />
      <Card title={`Kilder i registret (${rows.length})`} description="Registeret går forud for de indbyggede regler. Kilder, der ikke står her, rates efter kildetype og kendte domæner." actions={
        <form action={importAction}><button type="submit" className="btn btn-secondary" disabled={importing}>{importing ? "Importerer…" : "Importér standardkilder"}</button></form>
      }>
        <Result state={importState} />
        {rows.length === 0 ? <p className="ui-section-text">Registeret er tomt. Importér standardkilderne (politi, DMI, kommuner, nyhedsbureauer …), eller tilføj dine egne herunder.</p> : (
          <ul className="kr-sources">{rows.map((r) => <ProfileItem key={r.id} row={r} />)}</ul>
        )}
      </Card>
      <Card title="Tilføj kilde"><ProfileForm /></Card>
    </div>
  );
}
