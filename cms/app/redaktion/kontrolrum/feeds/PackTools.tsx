"use client";

import { useActionState } from "react";
import { Copy, DownloadCloud, LibraryBig } from "lucide-react";
import { Field } from "@/components/ui/Layout";
import { cloneFeedsAction, fetchAllAction, importCatalogAction, type FeedFormState } from "./actions";
import { Result } from "./FeedForm";
import type { CatalogOption, CityOption } from "./feed-types";

const INITIAL: FeedFormState = {};

/** Værktøjer til hele pakken: hent alle aktive, importér katalog, kopiér til en anden by. */
export function PackTools({ cityName, cities, catalogs, selectedIds, activeCount }: { cityName: string; cities: CityOption[]; catalogs: CatalogOption[]; selectedIds: string[]; activeCount: number }) {
  const [fetchState, fetchAction, fetching] = useActionState(fetchAllAction, INITIAL);
  const [importState, importAction, importing] = useActionState(importCatalogAction, INITIAL);
  const [cloneState, cloneAction, cloning] = useActionState(cloneFeedsAction, INITIAL);

  return (
    <div className="kp-tools">
      <section className="kp-tool" aria-labelledby="kp-hent">
        <h3 className="kr-h2" id="kp-hent"><DownloadCloud size={16} aria-hidden="true" /> Hent nu</h3>
        <p className="kr-layer-text">Henter de aktive RSS- og webkilder med det samme og lægger nyt som ugodkendte signaler i Production Engine. Højst ti ad gangen. CMS&apos;et henter aldrig af sig selv.</p>
        <form action={fetchAction}>
          <button type="submit" className="btn btn-primary" disabled={fetching || activeCount === 0}>{fetching ? "Henter…" : "Hent alle aktive"}</button>
        </form>
        <Result state={fetchState} />
      </section>

      <section className="kp-tool" aria-labelledby="kp-katalog">
        <h3 className="kr-h2" id="kp-katalog"><LibraryBig size={16} aria-hidden="true" /> Importér kildekatalog</h3>
        <p className="kr-layer-text">Hent en færdig liste over kilder ind som kladder. De er slået fra og har ingen adresse, til I har udfyldt dem. Erstat evt. by-navnet, hvis kataloget skal bruges i {cityName}.</p>
        <form action={importAction} className="ui-stack ui-gap-sm">
          <Field label="Katalog" htmlFor="kp-kat">
            <select id="kp-kat" name="katalog" className="input">{catalogs.map((c) => <option key={c.id} value={c.id}>{c.navn} ({c.antal} kilder)</option>)}</select>
          </Field>
          <Field label="Medtag" htmlFor="kp-pri"><select id="kp-pri" name="maxPri" className="input" defaultValue="2"><option value="0">Kun P0 (drift)</option><option value="1">P0 og P1</option><option value="2">Alle (P0-P2)</option></select></Field>
          <div className="ui-form-grid">
            <Field label="Erstat navn" htmlFor="kp-fra"><input id="kp-fra" name="fra" className="input" placeholder="Slagelse" maxLength={60} /></Field>
            <Field label="Med" htmlFor="kp-til"><input id="kp-til" name="til" className="input" placeholder={cityName} maxLength={60} /></Field>
          </div>
          <button type="submit" className="btn btn-secondary" disabled={importing}>{importing ? "Importerer…" : "Importér som kladder"}</button>
        </form>
        <Result state={importState} />
      </section>

      <section className="kp-tool" aria-labelledby="kp-klon">
        <h3 className="kr-h2" id="kp-klon"><Copy size={16} aria-hidden="true" /> Kopiér til en anden by</h3>
        {cities.length === 0 ? (
          <p className="kr-layer-text">Du har kun adgang til {cityName}. Bed en administrator give dig adgang til flere byer for at kopiere pakken.</p>
        ) : (
          <>
            <p className="kr-layer-text">Kopiér hele pakken eller de valgte kilder fra {cityName} til en anden by, og redigér derefter dér. Kopierne er slået fra, så intet hentes, før adresserne er tjekket.</p>
            <form action={cloneAction} className="ui-stack ui-gap-sm">
              {selectedIds.map((id) => <input key={id} type="hidden" name="id" value={id} />)}
              <Field label="Til by" htmlFor="kp-by"><select id="kp-by" name="by" className="input">{cities.map((c) => <option key={c.id} value={c.id}>{c.navn}</option>)}</select></Field>
              <fieldset className="kr-fieldset">
                <legend>Omfang</legend>
                <label className="check-row"><input type="radio" name="omfang" value="alle" defaultChecked /> Hele pakken</label>
                <label className="check-row"><input type="radio" name="omfang" value="valgte" disabled={selectedIds.length === 0} /> De {selectedIds.length} valgte</label>
              </fieldset>
              <div className="ui-form-grid">
                <Field label="Erstat navn" htmlFor="kp-cfra"><input id="kp-cfra" name="fra" className="input" defaultValue={cityName} maxLength={60} /></Field>
                <Field label="Med" htmlFor="kp-ctil"><input id="kp-ctil" name="til" className="input" placeholder="Næstved" maxLength={60} /></Field>
              </div>
              <label className="check-row"><input type="checkbox" name="behold" defaultChecked /> Behold adresser (fravælg, hvis de er særlige for {cityName})</label>
              <label className="check-row"><input type="checkbox" name="ratings" /> Kopiér også min egen kilderating</label>
              <button type="submit" className="btn btn-secondary" disabled={cloning}>{cloning ? "Kopierer…" : "Kopiér pakken"}</button>
            </form>
            <Result state={cloneState} />
          </>
        )}
      </section>
    </div>
  );
}
