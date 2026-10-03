"use client";

import { ArrowUpToLine, ImageIcon, Trash2 } from "lucide-react";
import { SOURCE_KIND_LABEL } from "@/lib/generate/types";
import { TYPE_DEFAULTS } from "@/lib/engine/source-rating";
import type { ClientSource } from "./types";

const TYPE_OPTIONS = Object.entries(TYPE_DEFAULTS).filter(([value]) => value !== "politi" && value !== "beredskab_112" && value !== "egen");

/** Kildegrundlaget med K-numre. K1 er hovedkilden: citatprofilerne bygger historien om den. */
export function SourceList({ sources, onChange, onRemove, onPromote }: { sources: ClientSource[]; onChange: (key: string, patch: Partial<ClientSource>) => void; onRemove: (key: string) => void; onPromote: (key: string) => void }) {
  if (sources.length === 0) return <p className="gen-empty">Ingen kilder endnu. Tilføj et feedkort, en webadresse, en PDF eller en tekst.</p>;
  return (
    <ol className="gen-sources" aria-label="Kildegrundlag">
      {sources.map((s, i) => (
        <li key={s.key} className="gen-source">
          <span className="gen-k" aria-label={`Kilde ${i + 1}`}>K{i + 1}</span>
          <div className="gen-source-body">
            <p className="gen-source-head">
              <strong className="gen-source-title">{s.titel}</strong>
              <span className="gen-meta">{SOURCE_KIND_LABEL[s.kind]}{i === 0 ? " · hovedkilde" : ""}</span>
            </p>
            <p className="gen-meta">
              {s.udgiver ?? "Ukendt afsender"}{s.dato ? ` · ${s.dato}` : ""}{s.kind === "signal" ? " · tekst hentes fra feedet" : ` · ${s.tekst.length.toLocaleString("da-DK")} tegn`}
            </p>
            {s.url && <p className="gen-url">{s.url}</p>}
            {s.noter.map((n) => <p key={n} className="gen-meta gen-warn">{n}</p>)}
            {s.kind !== "signal" && (
              <label className="gen-inline">
                <span>Kildetype</span>
                <select className="cms-input" value={s.type ?? ""} onChange={(e) => onChange(s.key, { type: e.target.value || null })} aria-label={`Kildetype for K${i + 1}`}>
                  <option value="">Ukendt (ratingen gætter forsigtigt)</option>
                  {TYPE_OPTIONS.map(([value, v]) => <option key={value} value={value}>{v.label}</option>)}
                </select>
              </label>
            )}
            {s.billeder.length > 0 && (
              <fieldset className="gen-images">
                <legend><ImageIcon size={13} aria-hidden="true" /> Billedreferencer ({s.billeder.length})</legend>
                <p className="gen-hint">Hentes ikke. Medtag dem, hvis AI skal foreslå alt-tekst og billedtekst ud fra det, kilden selv oplyser. Rettighederne er uafklarede, til en redaktør har afklaret dem.</p>
                {s.billeder.map((b, bi) => (
                  <label key={b.url} className="gen-image">
                    <input type="checkbox" checked={b.brug} onChange={(e) => onChange(s.key, { billeder: s.billeder.map((x, xi) => (xi === bi ? { ...x, brug: e.target.checked } : x)) })} />
                    <span><span className="gen-image-alt">{b.alt ?? b.billedtekst ?? "Uden alt-tekst"}</span><span className="gen-url">{b.url}</span></span>
                  </label>
                ))}
              </fieldset>
            )}
          </div>
          <div className="gen-source-actions">
            {i > 0 && <button type="button" className="cms-btn cms-btn-secondary" onClick={() => onPromote(s.key)} title="Gør til hovedkilde"><ArrowUpToLine size={14} aria-hidden="true" /><span className="cms-sr-only">Gør {s.titel} til hovedkilde</span></button>}
            <button type="button" className="cms-btn cms-btn-secondary" onClick={() => onRemove(s.key)}><Trash2 size={14} aria-hidden="true" /><span className="cms-sr-only">Fjern {s.titel}</span></button>
          </div>
        </li>
      ))}
    </ol>
  );
}
