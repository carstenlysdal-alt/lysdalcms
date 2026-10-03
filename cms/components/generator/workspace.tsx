"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { FilePlus2, RefreshCw, Sparkles } from "lucide-react";
import { createDraftAction, generateAction } from "@/app/redaktion/engine/generer/actions";
import type { GenerationResult, GenSource, ProfileId } from "@/lib/generate/types";
import { LIMITS } from "@/lib/generate/types";
import { ResultView } from "./result-view";
import { SourceAdder } from "./source-adder";
import { SourceList } from "./source-list";
import { newKey, type CategoryOption, type ClientSource, type ProfileOption, type SignalOption } from "./types";

type Props = { profiles: ProfileOption[]; categories: CategoryOption[]; signals: SignalOption[]; initialSignalIds: string[]; aiProvider: string | null; canUseAi: boolean };
type Done = { runId: string; result: GenerationResult; kilder: GenSource[]; udloeber: string };

/** Arbejdsrummet: kildegrundlaget til venstre, retningen og resultatet til højre. Intet udgives; kladden åbnes i Engine til gennemlæsning. */
export function GeneratorWorkspace({ profiles, categories, signals, initialSignalIds, aiProvider, canUseAi }: Props) {
  const router = useRouter();
  const [sources, setSources] = useState<ClientSource[]>(() =>
    initialSignalIds.flatMap((id) => {
      const s = signals.find((x) => x.id === id);
      return s && !s.spaerret && s.harTekst ? [{ key: newKey(), kind: "signal" as const, signalId: s.id, titel: s.titel, udgiver: s.kilde, url: null, dato: s.tidIso.slice(0, 10), type: s.type, tekst: "", billeder: [], noter: [] }] : [];
    }),
  );
  const [profil, setProfil] = useState<ProfileId>("nyhed");
  const [vinkel, setVinkel] = useState("");
  const [kategoriId, setKategoriId] = useState("");
  const [done, setDone] = useState<Done | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generating, startGenerate] = useTransition();
  const [creating, startCreate] = useTransition();

  const profile = profiles.find((p) => p.id === profil) ?? profiles[0];
  const usedSignals = useMemo(() => new Set(sources.flatMap((s) => (s.signalId ? [s.signalId] : []))), [sources]);
  const ready = sources.length >= profile.minKilder && canUseAi && aiProvider !== null;
  const reason = !canUseAi ? "Du har ikke adgang til AI i artikelarbejdet." : !aiProvider ? "AI er ikke tilsluttet. Nøglen (DEEPSEEK_API_KEY) sættes på serveren." : sources.length < profile.minKilder ? `${profile.titel} kræver mindst ${profile.minKilder} ${profile.minKilder === 1 ? "kilde" : "kilder"}.` : null;

  const patch = (key: string, p: Partial<ClientSource>) => setSources((list) => list.map((s) => (s.key === key ? { ...s, ...p } : s)));

  function generate() {
    setError(null);
    startGenerate(async () => {
      const res = await generateAction({
        profil, vinkel: vinkel.trim() || null, kategoriId: kategoriId || null,
        kilder: sources.map((s) => ({ kind: s.kind, signalId: s.signalId ?? null, titel: s.titel, udgiver: s.udgiver, url: s.url, dato: s.dato, type: s.type, tekst: s.tekst, billeder: s.billeder.filter((b) => b.brug).map(({ url, alt, billedtekst }) => ({ url, alt, billedtekst })) })),
      });
      if (!res.ok) return setError(res.error);
      setDone({ runId: res.runId, result: res.resultat, kilder: res.kilder, udloeber: res.udloeber });
    });
  }

  function createDraft() {
    if (!done) return;
    setError(null);
    startCreate(async () => {
      const res = await createDraftAction(done.runId, kategoriId || null);
      if (!res.ok) return setError(res.error);
      router.push(`/redaktion/engine?id=${res.articleId}&tab=feeds`);
    });
  }

  return (
    <div className="gen-layout">
      <section className="gen-col gen-col-sources" aria-labelledby="gen-sources-h">
        <div className="gen-col-head">
          <h2 id="gen-sources-h" className="gen-h2">Kildegrundlag</h2>
          <span className="gen-count"><span className="gen-num">{sources.length}</span> af {LIMITS.maxSources}</span>
        </div>
        <SourceList sources={sources} onChange={patch} onRemove={(key) => setSources((l) => l.filter((s) => s.key !== key))} onPromote={(key) => setSources((l) => { const i = l.findIndex((s) => s.key === key); return i > 0 ? [l[i], ...l.slice(0, i), ...l.slice(i + 1)] : l; })} />
        <SourceAdder signals={signals} usedSignalIds={usedSignals} full={sources.length >= LIMITS.maxSources} onAdd={(s) => setSources((l) => [...l, s])} />
      </section>

      <section className="gen-col gen-col-direction" aria-labelledby="gen-dir-h">
        <h2 id="gen-dir-h" className="gen-h2">Retning</h2>
        <fieldset className="gen-profiles">
          <legend className="gen-label">Profil</legend>
          {profiles.map((p) => (
            <label key={p.id} className={`gen-profile${p.id === profil ? " is-on" : ""}`}>
              <input type="radio" name="profil" value={p.id} checked={p.id === profil} onChange={() => setProfil(p.id)} />
              <span><strong>{p.titel}</strong><span className="gen-meta">{p.beskrivelse}</span></span>
            </label>
          ))}
        </fieldset>
        <div className="gen-form">
          <label className="gen-label" htmlFor="gen-vinkel">Vinkel eller ønske (valgfrit)</label>
          <textarea id="gen-vinkel" className="cms-input" rows={3} maxLength={LIMITS.briefChars} value={vinkel} onChange={(e) => setVinkel(e.target.value)} placeholder="Fx: Fokus på konsekvenserne for forældrene i Korsør." aria-describedby="gen-vinkel-hint" />
          <p id="gen-vinkel-hint" className="gen-hint">Styrer, hvad der vægtes. Ændrer aldrig fakta. {vinkel.length}/{LIMITS.briefChars}</p>
          <label className="gen-label" htmlFor="gen-sektion">Sektion</label>
          <select id="gen-sektion" className="cms-input" value={kategoriId} onChange={(e) => setKategoriId(e.target.value)}>
            <option value="">Vælg automatisk ud fra kilden</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.navn}</option>)}
          </select>
          <p className="gen-hint">Krimi og Sundhed er ikke på listen: AI-skrevet tekst er spærret dér.</p>
        </div>
        <div className="gen-go">
          <button type="button" className="cms-btn cms-btn-primary gen-go-btn" disabled={!ready || generating} onClick={generate}>
            <Sparkles size={16} aria-hidden="true" /> {generating ? "Skriver artiklen…" : done ? "Generér igen" : "Generér artikel"}
          </button>
          {reason && <p className="gen-hint" role="status">{reason}</p>}
          {generating && <p className="gen-hint" role="status" aria-live="polite">{aiProvider} skriver ud fra {sources.length} {sources.length === 1 ? "kilde" : "kilder"}. Det tager typisk 20-60 sekunder.</p>}
          {error && <p className="gen-error" role="alert">{error}</p>}
        </div>

        {done && (
          <>
            <ResultView result={done.result} sources={done.kilder} />
            <div className="gen-actions">
              <button type="button" className="cms-btn cms-btn-primary" disabled={creating} onClick={createDraft}><FilePlus2 size={16} aria-hidden="true" /> {creating ? "Opretter kladde…" : "Opret kladde og åbn i Engine"}</button>
              <button type="button" className="cms-btn cms-btn-secondary" disabled={generating} onClick={generate}><RefreshCw size={16} aria-hidden="true" /> Generér igen</button>
            </div>
            <p className="gen-hint">Kladden oprettes som idé, mærket AI-assisteret med kilderne. Den udgives aldrig automatisk. Kørslen gemmes til {new Date(done.udloeber).toLocaleDateString("da-DK")}.</p>
          </>
        )}
      </section>
    </div>
  );
}
