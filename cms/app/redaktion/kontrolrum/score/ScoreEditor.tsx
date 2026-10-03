"use client";

import { useMemo, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, RotateCcw, Save } from "lucide-react";
import { Notice } from "@/components/ui/Layout";
import { BAND_LABEL, DEFAULT_SCORE_CONFIG, DIMENSION_IDS, DIMENSION_LABEL, FUNCTION_IDS, FUNCTION_LABEL, PILLAR_IDS, PILLAR_LABEL, validateScoreConfig, type Band, type ScoreConfig } from "@/lib/score/config";
import { computeScore } from "@/lib/score/model";
import { resetScoreConfigAction, saveScoreConfigAction, type ScoreFormState } from "./actions";

const pct = (n: number) => (Math.round(n * 100) / 100).toString().replace(".", ",");
const TOP_BANDS: Band[] = ["URGENT", "HIGH", "POTENTIAL", "REVIEW"];

/** Redigér Local Score. Alt valideres her og igen på serveren; en ugyldig konfiguration kan ikke gemmes. */
export function ScoreEditor({ config: initial, version, tilpasset }: { config: ScoreConfig; version: number; tilpasset: boolean }) {
  const [cfg, setCfg] = useState<ScoreConfig>(initial);
  const [note, setNote] = useState("");
  const [state, setState] = useState<ScoreFormState>({});
  const [pending, start] = useTransition();
  const [sample, setSample] = useState<Record<string, number>>(() => Object.fromEntries(DIMENSION_IDS.map((d) => [d, 70])));
  const [sampleFn, setSampleFn] = useState<(typeof FUNCTION_IDS)[number]>("challenge");

  const check = useMemo(() => validateScoreConfig(cfg), [cfg]);
  const sum = DIMENSION_IDS.reduce((n, d) => n + cfg.weights[d], 0);
  const preview = useMemo(() => {
    if (!check.ok) return null;
    return computeScore({ dimensions: sample as never, functions: Object.fromEntries(FUNCTION_IDS.map((f) => [f, f === sampleFn ? 80 : 30])) as never }, check.config);
  }, [check, sample, sampleFn]);
  const dirty = JSON.stringify(cfg) !== JSON.stringify(initial);

  const move = (i: number, dir: -1 | 1) => setCfg((c) => { const t = [...c.tiebreak]; const j = i + dir; if (j < 0 || j >= t.length) return c; [t[i], t[j]] = [t[j], t[i]]; return { ...c, tiebreak: t }; });
  const setThreshold = (band: Band, min: number) => setCfg((c) => ({ ...c, thresholds: c.thresholds.map((t) => (t.band === band ? { ...t, min } : t)) }));

  return (
    <div className="se">
      <form className="se-main" onSubmit={(e) => { e.preventDefault(); setState({}); start(async () => setState(await saveScoreConfigAction(JSON.stringify(cfg), version, note))); }}>
        <section className="se-sec" aria-labelledby="se-vaegte">
          <h2 id="se-vaegte" className="se-h">Vægte for de syv dimensioner</h2>
          <p className="se-help">AI giver hver dimension 0-100. Totalen er summen af score × vægt. Vægtene skal give 1,00.</p>
          <table className="se-table">
            <thead><tr><th scope="col">Dimension</th><th scope="col" className="se-r">Vægt</th></tr></thead>
            <tbody>
              {DIMENSION_IDS.map((d) => (
                <tr key={d}>
                  <th scope="row"><label htmlFor={`w-${d}`}>{DIMENSION_LABEL[d].navn}</label><span className="se-help">{DIMENSION_LABEL[d].hjaelp}</span></th>
                  <td className="se-r"><input id={`w-${d}`} className="input se-num" type="number" min={0} max={1} step={0.01} value={cfg.weights[d]} onChange={(e) => setCfg({ ...cfg, weights: { ...cfg.weights, [d]: Number(e.target.value) } })} /></td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr><th scope="row">I alt</th><td className={`se-r se-sum${Math.abs(sum - 1) > 0.001 ? " is-bad" : ""}`}>{pct(sum)}{Math.abs(sum - 1) > 0.001 ? " (skal være 1,00)" : ""}</td></tr></tfoot>
          </table>
        </section>

        <section className="se-sec" aria-labelledby="se-baand">
          <h2 id="se-baand" className="se-h">Bånd</h2>
          <p className="se-help">Laveste total, der giver båndet. Alt under Lav er Ignorér.</p>
          <div className="se-bands">
            {TOP_BANDS.map((b) => {
              const t = cfg.thresholds.find((x) => x.band === b)!;
              return (
                <label key={b} className="se-band"><span>{BAND_LABEL[b]}</span><input className="input se-num" type="number" min={1} max={100} step={1} value={t.min} onChange={(e) => setThreshold(b, Number(e.target.value))} /></label>
              );
            })}
            <label className="se-band"><span>{BAND_LABEL.IGNORE}</span><input className="input se-num" type="number" value={0} disabled aria-label="Ignorér starter ved 0" /></label>
          </div>
          <div className="se-bands">
            {(["URGENT", "HIGH", "POTENTIAL"] as Band[]).map((b) => (
              <label key={b} className="se-band"><span>Foreslået prioritet for {BAND_LABEL[b].toLowerCase()}</span>
                <select className="input" value={cfg.priorityByBand[b] ?? ""} onChange={(e) => setCfg({ ...cfg, priorityByBand: { ...cfg.priorityByBand, [b]: (e.target.value || undefined) as "A" | "B" | "C" | undefined } })}>
                  <option value="">Ingen</option><option value="A">A</option><option value="B">B</option><option value="C">C</option>
                </select>
              </label>
            ))}
          </div>
        </section>

        <section className="se-sec" aria-labelledby="se-funk">
          <h2 id="se-funk" className="se-h">Journalistiske funktioner</h2>
          <p className="se-help">AI scorer 11 funktioner. Den højeste er primær; ved lighed vinder den, der står øverst. Hver funktion hører til en søjle og har et anbefalet format.</p>
          <ol className="se-fns">
            {cfg.tiebreak.map((f, i) => (
              <li key={f} className="se-fn">
                <span className="se-pos">{i + 1}</span>
                <span className="se-fn-name">{FUNCTION_LABEL[f]}</span>
                <select className="input" aria-label={`Søjle for ${FUNCTION_LABEL[f]}`} value={cfg.pillarByFunction[f]} onChange={(e) => setCfg({ ...cfg, pillarByFunction: { ...cfg.pillarByFunction, [f]: e.target.value as never } })}>
                  {PILLAR_IDS.map((p) => <option key={p} value={p}>{PILLAR_LABEL[p]}</option>)}
                </select>
                <input className="input se-fmt" aria-label={`Anbefalet format for ${FUNCTION_LABEL[f]}`} value={cfg.formatByFunction[f]} maxLength={120} onChange={(e) => setCfg({ ...cfg, formatByFunction: { ...cfg.formatByFunction, [f]: e.target.value } })} />
                <span className="se-move">
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => move(i, -1)} disabled={i === 0}><ArrowUp size={14} aria-hidden="true" /><span className="sr-only cms-sr-only">Flyt {FUNCTION_LABEL[f]} op</span></button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => move(i, 1)} disabled={i === cfg.tiebreak.length - 1}><ArrowDown size={14} aria-hidden="true" /><span className="sr-only cms-sr-only">Flyt {FUNCTION_LABEL[f]} ned</span></button>
                </span>
              </li>
            ))}
          </ol>
          <div className="se-bands">
            <label className="se-band"><span>Sekundære funktioner: score over</span><input className="input se-num" type="number" min={0} max={100} value={cfg.secondaryMin} onChange={(e) => setCfg({ ...cfg, secondaryMin: Number(e.target.value) })} /></label>
            <label className="se-band"><span>Højst antal</span><input className="input se-num" type="number" min={0} max={5} value={cfg.secondaryMax} onChange={(e) => setCfg({ ...cfg, secondaryMax: Number(e.target.value) })} /></label>
          </div>
        </section>

        <section className="se-sec" aria-labelledby="se-soejle">
          <h2 id="se-soejle" className="se-h">Søjlernes sammensætning</h2>
          <p className="se-help">Hver søjle er en vægtet sum af funktionerne (og troværdighed). Vægtene i en søjle skal give 1,00.</p>
          {PILLAR_IDS.map((p) => {
            const entries = Object.entries(cfg.pillarWeights[p]);
            const total = entries.reduce((n, [, w]) => n + (w ?? 0), 0);
            return (
              <fieldset key={p} className="se-pillar">
                <legend>{PILLAR_LABEL[p]} <span className={`se-sum${Math.abs(total - 1) > 0.001 ? " is-bad" : ""}`}>{pct(total)}</span></legend>
                <div className="se-pgrid">
                  {entries.map(([k, w]) => (
                    <label key={k} className="se-p"><span>{k === "trust" ? "Troværdighed" : FUNCTION_LABEL[k as keyof typeof FUNCTION_LABEL]}</span>
                      <input className="input se-num" type="number" min={0} max={1} step={0.01} value={w ?? 0} onChange={(e) => setCfg({ ...cfg, pillarWeights: { ...cfg.pillarWeights, [p]: { ...cfg.pillarWeights[p], [k]: Number(e.target.value) } } })} />
                    </label>
                  ))}
                </div>
              </fieldset>
            );
          })}
        </section>

        <section className="se-sec">
          <label className="se-help" htmlFor="se-note">Note til historikken (valgfri)</label>
          <input id="se-note" className="input" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} />
          <div className="ui-actions">
            <button type="submit" className="btn btn-primary" disabled={pending || !check.ok || !dirty}><Save size={16} aria-hidden="true" /> {pending ? "Gemmer…" : "Gem som ny version"}</button>
            <button type="button" className="btn btn-secondary" onClick={() => setCfg(DEFAULT_SCORE_CONFIG)}>Indsæt standardværdier</button>
            {tilpasset && <button type="button" className="btn btn-secondary" disabled={pending} onClick={() => start(async () => { const r = await resetScoreConfigAction(version); setState(r); })}><RotateCcw size={16} aria-hidden="true" /> Nulstil til standard</button>}
          </div>
          {!check.ok && <Notice tone="warn">{check.error}</Notice>}
          {state.error && <Notice tone="danger">{state.error}</Notice>}
          {state.ok && state.besked && <Notice tone="success">{state.besked}</Notice>}
        </section>
      </form>

      <aside className="se-side" aria-label="Prøv vægtene">
        <h2 className="se-h">Prøv vægtene</h2>
        <p className="se-help">Sæt delscorer, som AI kunne give, og se hvad din konfiguration (også ugemt) gør ved totalen.</p>
        {DIMENSION_IDS.map((d) => (
          <label key={d} className="se-slider"><span>{DIMENSION_LABEL[d].navn}</span><input type="range" min={0} max={100} value={sample[d]} onChange={(e) => setSample({ ...sample, [d]: Number(e.target.value) })} /><output>{sample[d]}</output></label>
        ))}
        <label className="se-slider"><span>Stærkeste funktion</span>
          <select className="input" value={sampleFn} onChange={(e) => setSampleFn(e.target.value as never)}>{FUNCTION_IDS.map((f) => <option key={f} value={f}>{FUNCTION_LABEL[f]}</option>)}</select>
        </label>
        {preview ? (
          <div className="se-result" aria-live="polite">
            <p className="se-total"><span className="se-big">{preview.total}</span> <span>{BAND_LABEL[preview.band]}</span></p>
            <p>Primær funktion: <strong>{FUNCTION_LABEL[preview.primaryFunction]}</strong> · søjle {PILLAR_LABEL[preview.pillar]}</p>
            <p>Anbefalet format: {preview.recommendedFormat}</p>
            <p>Foreslået prioritet: {preview.suggestedPriority ?? "ingen"}</p>
          </div>
        ) : <p className="se-help">Ret fejlen i konfigurationen for at se resultatet.</p>}
      </aside>
    </div>
  );
}
