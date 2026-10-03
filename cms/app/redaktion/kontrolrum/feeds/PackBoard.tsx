"use client";

import { useActionState, useMemo, useState } from "react";
import { Download, Pencil, Trash2 } from "lucide-react";
import { Notice } from "@/components/ui/Layout";
import { FEED_TYPE_LABEL, PRIORITY_LABEL } from "@/lib/feeds/input";
import { bulkFeedsAction, deleteFeedAction, fetchFeedAction, type FeedFormState } from "./actions";
import { FeedForm, Result } from "./FeedForm";
import type { CatalogOption, CityOption, FeedItemRow } from "./feed-types";
import { PackTools } from "./PackTools";

const INITIAL: FeedFormState = {};
type Status = "alle" | "aktive" | "kladder" | "mangler" | "fejl";
type Sort = "prioritet" | "navn" | "kategori" | "hentet";
type Group = "prioritet" | "kategori" | "ingen";

const missingUrl = (r: FeedItemRow) => r.type !== "mail" && !r.url;
const canFetch = (r: FeedItemRow) => (r.type === "rss" || r.type === "web") && Boolean(r.url);

function statusText(r: FeedItemRow): { kind: "aktiv" | "kladde" | "fejl"; text: string } {
  if (r.sidsteStatus === "fejl") return { kind: "fejl", text: r.sidsteBesked ?? "Sidste hentning fejlede" };
  if (!r.aktiv) return { kind: "kladde", text: missingUrl(r) ? "Kladde · mangler adresse" : "Slået fra" };
  if (r.hentetLabel) return { kind: "aktiv", text: `Aktiv · hentet ${r.hentetLabel}${r.sidsteAntal !== null ? ` · ${r.sidsteAntal} nye` : ""}` };
  return { kind: "aktiv", text: "Aktiv · ikke hentet endnu" };
}

function Row({ row, categories, selected, onToggle }: { row: FeedItemRow; categories: string[]; selected: boolean; onToggle: () => void }) {
  const [open, setOpen] = useState(false);
  const [fetchState, fetchAction, fetching] = useActionState(fetchFeedAction, INITIAL);
  const [delState, delAction, deleting] = useActionState(deleteFeedAction, INITIAL);
  const st = statusText(row);
  return (
    <li className={`kp-row${selected ? " is-selected" : ""}${row.aktiv ? "" : " is-off"}`}>
      <div className="kp-row-line">
        <input className="kp-check" type="checkbox" name="id" value={row.id} form="bulk-form" checked={selected} onChange={onToggle} aria-label={`Vælg ${row.navn}`} />
        <div className="kp-row-main">
          <strong className="kp-name">{row.navn}</strong>
          <span className="kp-meta">
            {row.kategori ? `${row.kategori} · ` : ""}{FEED_TYPE_LABEL[row.type as keyof typeof FEED_TYPE_LABEL] ?? row.type} · hvert {row.intervalMin}. min{row.omraadeTekst ? ` · ${row.omraadeTekst}` : ""}
          </span>
          {row.url && <span className="kp-url">{row.url}</span>}
        </div>
        <span className={`kp-status is-${st.kind}`}><span className="kp-dot" aria-hidden="true" />{st.text}</span>
        <div className="kp-actions">
          {canFetch(row) && (
            <form action={fetchAction}>
              <input type="hidden" name="id" value={row.id} />
              <button type="submit" className="btn btn-secondary btn-sm" disabled={fetching}><Download size={14} aria-hidden="true" /> {fetching ? "Henter…" : "Hent nu"}</button>
            </form>
          )}
          <button type="button" className="btn btn-ghost btn-sm" aria-expanded={open} onClick={() => setOpen((v) => !v)}><Pencil size={14} aria-hidden="true" /> {open ? "Luk" : "Redigér"}</button>
        </div>
      </div>
      {(fetchState.error || fetchState.ok) && <p className={`kp-row-result${fetchState.error ? " is-error" : ""}`} role={fetchState.error ? "alert" : "status"}>{fetchState.error ?? fetchState.besked}</p>}
      {open && (
        <div className="kp-edit">
          <FeedForm row={row} categories={categories} onDone={() => setOpen(false)} />
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

function BulkBar({ count, onClear }: { count: number; onClear: () => void }) {
  const [state, action, pending] = useActionState(async (prev: FeedFormState, fd: FormData) => {
    const res = await bulkFeedsAction(prev, fd);
    if (res.ok) onClear();
    return res;
  }, INITIAL);
  return (
    <form id="bulk-form" action={action} className="kp-bulk" aria-label="Handlinger på valgte feeds">
      <p className="kp-bulk-count"><strong className="kp-num">{count}</strong> valgt</p>
      <div className="kp-bulk-actions">
        <button type="submit" name="op" value="til" className="btn btn-secondary btn-sm" disabled={pending}>Slå til</button>
        <button type="submit" name="op" value="fra" className="btn btn-secondary btn-sm" disabled={pending}>Slå fra</button>
        <span className="kp-bulk-set">
          <select name="vaerdi" className="input" aria-label="Ny prioritet" defaultValue="2">{[1, 2, 3].map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}</select>
          <button type="submit" name="op" value="prioritet" className="btn btn-secondary btn-sm" disabled={pending}>Sæt prioritet</button>
        </span>
        <button type="submit" name="op" value="slet" className="btn btn-danger btn-sm" disabled={pending}>Fjern</button>
      </div>
      <Result state={state} />
    </form>
  );
}

export function PackBoard({ rows, cityName, cities, catalogs }: { rows: FeedItemRow[]; cityName: string; cities: CityOption[]; catalogs: CatalogOption[] }) {
  const [q, setQ] = useState("");
  const [kategori, setKategori] = useState("");
  const [status, setStatus] = useState<Status>("alle");
  const [sort, setSort] = useState<Sort>("prioritet");
  const [group, setGroup] = useState<Group>("prioritet");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const categories = useMemo(() => Array.from(new Set(rows.map((r) => r.kategori).filter((c): c is string => Boolean(c)))).sort((a, b) => a.localeCompare(b, "da")), [rows]);
  const counts = useMemo(() => ({ alle: rows.length, aktive: rows.filter((r) => r.aktiv).length, kladder: rows.filter((r) => !r.aktiv).length, mangler: rows.filter(missingUrl).length, fejl: rows.filter((r) => r.sidsteStatus === "fejl").length }), [rows]);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = rows.filter((r) => {
      if (kategori && (r.kategori ?? "") !== kategori) return false;
      if (status === "aktive" && !r.aktiv) return false;
      if (status === "kladder" && r.aktiv) return false;
      if (status === "mangler" && !missingUrl(r)) return false;
      if (status === "fejl" && r.sidsteStatus !== "fejl") return false;
      return !needle || `${r.navn} ${r.kategori ?? ""} ${r.url ?? ""} ${r.omraadeTekst ?? ""} ${r.noter ?? ""}`.toLowerCase().includes(needle);
    });
    const cmp: Record<Sort, (a: FeedItemRow, b: FeedItemRow) => number> = {
      prioritet: (a, b) => a.prioritet - b.prioritet || a.navn.localeCompare(b.navn, "da"),
      navn: (a, b) => a.navn.localeCompare(b.navn, "da"),
      kategori: (a, b) => (a.kategori ?? "￿").localeCompare(b.kategori ?? "￿", "da") || a.navn.localeCompare(b.navn, "da"),
      hentet: (a, b) => Number(Boolean(a.hentetLabel)) - Number(Boolean(b.hentetLabel)) || a.navn.localeCompare(b.navn, "da"),
    };
    return [...list].sort(cmp[sort]);
  }, [rows, q, kategori, status, sort]);

  const groups = useMemo(() => {
    const map = new Map<string, FeedItemRow[]>();
    for (const r of visible) {
      const key = group === "prioritet" ? (PRIORITY_LABEL[r.prioritet] ?? "Andet") : group === "kategori" ? (r.kategori ?? "Uden kategori") : "Alle kilder";
      map.set(key, [...(map.get(key) ?? []), r]);
    }
    return Array.from(map.entries());
  }, [visible, group]);

  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const toggleMany = (ids: string[]) => setSelected((s) => { const n = new Set(s); const all = ids.every((i) => n.has(i)); for (const i of ids) { if (all) n.delete(i); else n.add(i); } return n; });
  const selectedIds = Array.from(selected).filter((id) => rows.some((r) => r.id === id));

  return (
    <div className="kp">
      <dl className="kp-summary" aria-label={`Kildepakke for ${cityName}`}>
        <div><dt>Kilder</dt><dd className="kp-num">{counts.alle}</dd></div>
        <div><dt>Aktive</dt><dd className="kp-num">{counts.aktive}</dd></div>
        <div><dt>Kladder</dt><dd className="kp-num">{counts.kladder}</dd></div>
        <div><dt>Mangler adresse</dt><dd className="kp-num">{counts.mangler}</dd></div>
        <div><dt>Fejl</dt><dd className="kp-num">{counts.fejl}</dd></div>
      </dl>

      <div className="kp-layout">
        <section className="kp-main" aria-label="Kilder i pakken">
          <div className="kp-filters" role="search" aria-label="Sortér og filtrér kilderne">
            <input type="search" className="input kp-search" placeholder="Søg i navn, kategori, adresse…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Søg i kilderne" />
            <label className="kp-filter"><span>Vis</span>
              <select className="input" value={status} onChange={(e) => setStatus(e.target.value as Status)}>
                <option value="alle">Alle ({counts.alle})</option>
                <option value="aktive">Aktive ({counts.aktive})</option>
                <option value="kladder">Kladder ({counts.kladder})</option>
                <option value="mangler">Mangler adresse ({counts.mangler})</option>
                <option value="fejl">Fejl ({counts.fejl})</option>
              </select>
            </label>
            <label className="kp-filter"><span>Kategori</span>
              <select className="input" value={kategori} onChange={(e) => setKategori(e.target.value)}>
                <option value="">Alle</option>
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label className="kp-filter"><span>Sortér</span>
              <select className="input" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
                <option value="prioritet">Prioritet</option>
                <option value="navn">Navn</option>
                <option value="kategori">Kategori</option>
                <option value="hentet">Hentet</option>
              </select>
            </label>
            <label className="kp-filter"><span>Gruppér</span>
              <select className="input" value={group} onChange={(e) => setGroup(e.target.value as Group)}>
                <option value="prioritet">Prioritet</option>
                <option value="kategori">Kategori</option>
                <option value="ingen">Ingen</option>
              </select>
            </label>
          </div>

          {selectedIds.length > 0 && <BulkBar count={selectedIds.length} onClear={() => setSelected(new Set())} />}
          {selectedIds.length === 0 && <form id="bulk-form" aria-hidden="true" hidden />}

          {rows.length === 0 && <Notice tone="info" title="Pakken er tom">Importér et kildekatalog eller tilføj det første feed. Kataloget giver jer en liste at gå ud fra; adresserne udfylder I selv.</Notice>}
          {rows.length > 0 && visible.length === 0 && <p className="ui-section-text">Ingen kilder matcher filtrene.</p>}

          {groups.map(([name, list]) => (
            <section key={name} className="kp-group" aria-label={name}>
              <header className="kp-group-head">
                <label className="kp-group-title">
                  <input className="kp-check" type="checkbox" checked={list.every((r) => selected.has(r.id))} onChange={() => toggleMany(list.map((r) => r.id))} aria-label={`Vælg alle i ${name}`} />
                  <h3>{name}</h3>
                </label>
                <span className="kp-group-count"><span className="kp-num">{list.length}</span> {list.length === 1 ? "kilde" : "kilder"}</span>
              </header>
              <ul className="kp-rows">
                {list.map((r) => <Row key={r.id} row={r} categories={categories} selected={selected.has(r.id)} onToggle={() => toggle(r.id)} />)}
              </ul>
            </section>
          ))}
        </section>

        <aside className="kp-side" aria-label="Værktøjer til kildepakken">
          <PackTools cityName={cityName} cities={cities} catalogs={catalogs} selectedIds={selectedIds} activeCount={counts.aktive} />
          <div className="kp-new">
            <h3 className="kr-h2">Tilføj en enkelt kilde</h3>
            <FeedForm categories={categories} />
          </div>
        </aside>
      </div>
    </div>
  );
}
