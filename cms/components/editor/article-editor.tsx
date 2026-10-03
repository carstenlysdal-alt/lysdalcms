"use client";

import "@/styles/cms-editor.css";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { ArrowLeft, Eye, Save, Send, TriangleAlert, X } from "lucide-react";
import { saveArticle, type ArticleFormState } from "@/app/redaktion/artikler/actions";
import { saveDraftAction } from "@/app/redaktion/artikler/draft-actions";
import { applyAcceptedAiUse, isTextGeneratingTask, type EditorialTask, type TaskResult } from "@/lib/ai/editorial-schemas";
import { articleMetaSchema, defaultUtm, META_LIMITS, type ArticleMetaForm, type SocialPlatform } from "@/lib/article-meta";
import { blocksPlainText, countWords } from "@/lib/blocks/text";
import { computeSeoScore } from "@/lib/editor/seo-score";
import { formSignature, initialFormState, toFormData, type FormState } from "@/lib/editor/form-state";
import { fromLocalInput, charCount } from "@/lib/editor/format";
import type { ArticleEditorValue, EditorFlags, EditorOptions, EditorSite, MediaOption } from "@/lib/editor/types";
import { usesAi, AI_USE_NONE } from "@/lib/marking";
import type { ArticleSeoInput } from "@/lib/seo/article-seo";
import { absoluteUrl, articlePath } from "@/lib/seo/url";
import { MAX_EXCERPT_CHARS, MAX_EXCERPTS_TOTAL } from "@/lib/ai/editorial-schemas";
import type { SourceProfileLite } from "@/lib/engine/source-rating";
import type { SourceDraft } from "@/lib/engine/types";
import { useRegisterSourceAdder, type AddSourceResult } from "@/components/engine/engine-bus";
import { EngineCopilot } from "@/components/engine/copilot";
import { slugify } from "@/lib/slug";
import { AiChip, CharCounter, SaveIndicator, SuggestButton, type SaveState } from "./primitives";
import { BlockEditor, type BlockAi } from "./block-editor";
import { CoverField } from "./media-picker";
import { SuggestionTray, type SuggestionActions } from "./ai-panels";
import { KnowledgePanel } from "./knowledge-panel";
import { useEditorialAi } from "./use-editorial-ai";
import { useEditorBridge } from "./editor-bridge";
import {
  AdvancedSection, AiSection, MarkingSection, PlanningSection, SeoSection, SocialSection, SourcesSection,
  type AiBundle, type SectionProps,
} from "./editor-sections";

export type ArticleEditorProps = {
  article: ArticleEditorValue;
  options: EditorOptions;
  flags: EditorFlags;
  site: EditorSite;
  transitions: string[];
  mode: "panel" | "page" | "engine";
  /** Production Engine: kilderegister og AI-udbyder til copiloten (kun i engine-tilstand). */
  engine?: { profiles: SourceProfileLite[]; aiProvider: string | null };
  /** Panel-tilstand: link der lukker panelet (fjerner ?id=). */
  closeHref?: string;
  /** Kildeverifikation-flag fra marking (kladder fra Q&A/interview/meddeler). */
  hasUnverifiedSource: boolean;
  children?: React.ReactNode;
};

const AUTOSAVE_MS = 2000;
const LIVE_STATUSES = new Set(["Publiceret"]);

function buildSeoInput(a: { form: FormState; base: string; categoryName?: string; sektionSlug: string; cover: MediaOption | null; ogMedia: MediaOption | null; twitterMedia: MediaOption | null }): ArticleSeoInput {
  const parsed = articleMetaSchema.safeParse(a.form.meta);
  return {
    base: a.base || "https://example.dk",
    titel: a.form.titel,
    manchet: a.form.manchet,
    seoTitel: a.form.seoTitel,
    seoBeskrivelse: a.form.seoBeskrivelse,
    slug: a.form.slug || "artikel",
    sprog: a.form.sprog,
    sektion: { navn: a.categoryName ?? "Nyheder", slug: a.sektionSlug },
    meta: parsed.success ? parsed.data : undefined,
    cover: a.cover,
    ogMedia: a.ogMedia,
    twitterMedia: a.twitterMedia,
    draft: true,
  };
}

function statusTone(status: string): string {
  if (status === "Publiceret" || status === "Distribueret") return "published";
  if (status === "Planlagt") return "planned";
  if (["Godkendelse", "Redigering", "Faktatjek", "Juridisk kontrol", "SEO", "Medievalg"].includes(status)) return "review";
  if (status === "Afvist") return "danger";
  if (status === "Arkiveret") return "archived";
  return "draft";
}

export function ArticleEditor({ article, options, flags, site, transitions, mode, engine, closeHref, hasUnverifiedSource, children }: ArticleEditorProps) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(() => initialFormState(article));
  const formRef = useRef(form);

  const [articleId, setArticleId] = useState<string | null>(article.id);
  const idRef = useRef(articleId);
  const versionRef = useRef(article.version);
  const [initialSig] = useState(() => formSignature(form));
  const savedSig = useRef(initialSig);
  const [savedSigState, setSavedSigState] = useState(initialSig);
  const markSaved = (sig: string) => { savedSig.current = sig; setSavedSigState(sig); };
  const savingRef = useRef(false);
  const queuedRef = useRef(false);
  const stoppedRef = useRef(false); // konflikt: stop automatisk gem
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [saveState, setSaveState] = useState<SaveState>({ kind: "idle", savedAt: null });
  const [result, setResult] = useState<ArticleFormState>({});
  const [pending, startTransition] = useTransition();
  const [slugTouched, setSlugTouched] = useState(() => Boolean(article.slug) && article.slug !== slugify(article.titel));
  const slugTouchedRef = useRef(slugTouched);
  // Refs holdes i sync efter render (læses kun i handlers/timere, aldrig under render).
  useEffect(() => {
    formRef.current = form;
    idRef.current = articleId;
    slugTouchedRef.current = slugTouched;
  });
  const [aiNotice, setAiNotice] = useState("");
  const [aiHighlight, setAiHighlight] = useState(false);
  const live = LIVE_STATUSES.has(article.status);

  const set = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value })), []);
  const setMeta = useCallback((patch: Partial<ArticleMetaForm>) => setForm((f) => ({ ...f, meta: { ...f.meta, ...patch } })), []);

  // ── Titel/slug ──
  function onTitle(titel: string) {
    setForm((f) => ({ ...f, titel, ...(!slugTouched && !live ? { slug: slugify(titel) } : {}) }));
  }
  function onSlug(slug: string) {
    setSlugTouched(true);
    set("slug", slug);
  }

  // ── Afledte værdier ──
  const category = options.categories.find((c) => c.id === form.kategoriId) ?? null;
  const cover = options.media.find((m) => m.id === form.coverMediaId) ?? null;
  const ogMedia = options.media.find((m) => m.id === form.meta.ogMediaId) ?? null;
  const twitterMedia = options.media.find((m) => m.id === form.meta.twitterMediaId) ?? null;
  const bodyText = useMemo(() => blocksPlainText(form.blocks), [form.blocks]);
  const wordCount = useMemo(() => countWords(bodyText), [bodyText]);
  const sektionSlug = category?.sektionSlug ?? "nyheder";
  const articleUrl = site.base && form.slug ? absoluteUrl(site.base, articlePath(sektionSlug, form.slug)) : "";
  const restricted = flags.restrictedCategoryIds.includes(form.kategoriId);
  const aiNone = form.aiBrug.includes(AI_USE_NONE);
  const aiUses = form.aiBrug.filter((v) => v !== AI_USE_NONE);

  const score = useMemo(
    () => computeSeoScore({
      titel: form.titel, seoTitel: form.seoTitel, manchet: form.manchet, seoBeskrivelse: form.seoBeskrivelse, slug: form.slug,
      kategoriId: form.kategoriId, forfatterId: form.forfatterId, cover, tagCount: form.tagIds.length, geoCount: form.geoTagIds.length, wordCount,
      meta: articleMetaSchema.safeParse(form.meta).data, shareImageAvailable: Boolean(cover || ogMedia),
    }),
    [form, cover, ogMedia, wordCount],
  );

  const seoInput = buildSeoInput({ form, base: site.base, categoryName: category?.navn, sektionSlug, cover, ogMedia, twitterMedia });

  // ── Autosave ──
  const runAutosave = useCallback(async () => {
    if (stoppedRef.current || LIVE_STATUSES.has(article.status)) return;
    if (savingRef.current) { queuedRef.current = true; return; }
    const f = formRef.current;
    const sig = formSignature(f);
    if (sig === savedSig.current) return;
    if (f.titel.trim().length < 3) {
      setSaveState({ kind: "off", message: "Giv artiklen en titel (mindst 3 tegn) for at gemme automatisk." });
      return;
    }
    savingRef.current = true;
    setSaveState({ kind: "saving" });
    try {
      const res = await saveDraftAction(idRef.current, toFormData(f, { baseVersion: versionRef.current, slugAuto: !slugTouchedRef.current }));
      if (res.ok) {
        versionRef.current = res.version;
        let nextSig = sig;
        if (res.slug && res.slug !== f.slug && !slugTouchedRef.current) {
          const synced = { ...formRef.current, slug: res.slug };
          setForm(synced);
          nextSig = formSignature({ ...f, slug: res.slug });
        }
        markSaved(nextSig);
        if (res.created) {
          setArticleId(res.id);
          idRef.current = res.id;
          const url = new URL(window.location.href);
          if (mode === "panel" || mode === "engine") url.searchParams.set("id", res.id);
          else url.pathname = `/redaktion/artikler/${res.id}`;
          window.history.replaceState(null, "", url.toString());
        }
        setSaveState({ kind: "saved", savedAt: new Date(res.savedAt), auto: true });
      } else if (res.conflict) {
        stoppedRef.current = true;
        setSaveState({ kind: "conflict", message: res.error });
      } else {
        setSaveState({ kind: "error", message: res.error });
      }
    } catch {
      setSaveState({ kind: "error", message: "Kunne ikke gemme automatisk. Tjek forbindelsen." });
    } finally {
      savingRef.current = false;
      if (queuedRef.current) { queuedRef.current = false; schedule(); }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [article.status, mode]);

  function schedule() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { void runAutosave(); }, AUTOSAVE_MS);
  }

  const sig = formSignature(form);
  const dirty = sig !== savedSigState;
  useEffect(() => {
    if (sig === savedSig.current || live || stoppedRef.current) return;
    schedule();
    return () => { if (timer.current) clearTimeout(timer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, live]);
  // Vist tilstand udledes under render (ingen setState i effekt).
  let shownState: SaveState = saveState;
  if (dirty && live) shownState = { kind: "off", message: "Publiceret artikel: ændringer gemmes først, når du klikker Opdater artikel." };
  else if (dirty && (saveState.kind === "idle" || saveState.kind === "saved")) shownState = { kind: "dirty", savedAt: saveState.savedAt };

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (formSignature(formRef.current) !== savedSig.current) { e.preventDefault(); e.returnValue = ""; }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  async function waitIdle() {
    for (let i = 0; i < 100 && savingRef.current; i++) await new Promise((r) => setTimeout(r, 100));
  }

  // ── Eksplicit gem (Opdater/Publicér/statusskift) ──
  function submit(targetStatus: string | null) {
    if (timer.current) clearTimeout(timer.current);
    setResult({});
    startTransition(async () => {
      await waitIdle();
      const f = formRef.current;
      const sigAtSend = formSignature(f);
      setSaveState({ kind: "saving" });
      const res = await saveArticle(idRef.current, {}, toFormData(f, { baseVersion: versionRef.current, targetStatus, slugAuto: !slugTouchedRef.current && !live }));
      setResult(res);
      if (res.success) {
        if (res.version) versionRef.current = res.version;
        let nextSig = sigAtSend;
        if (res.slug && res.slug !== f.slug) { setForm((cur) => ({ ...cur, slug: res.slug! })); nextSig = formSignature({ ...f, slug: res.slug }); }
        markSaved(nextSig);
        setSaveState({ kind: "saved", savedAt: new Date(), auto: false });
        if (targetStatus) router.refresh();
      } else if (res.conflict) {
        stoppedRef.current = true;
        setSaveState({ kind: "conflict", message: res.error ?? "Konflikt." });
      } else {
        setSaveState({ kind: "error", message: res.error ?? "Kunne ikke gemme." });
      }
    });
  }

  // ── AI ──
  const getContext = useCallback(() => {
    const f = formRef.current;
    return {
      titel: f.titel,
      manchet: f.manchet,
      brodtekst: blocksPlainText(f.blocks).slice(0, 30000),
      kategoriId: f.kategoriId || null,
      geoTagIds: f.geoTagIds,
      tagIds: f.tagIds,
      sprog: f.sprog || "da",
      kilder: (() => {
        let budget = MAX_EXCERPTS_TOTAL;
        return f.meta.kilder.filter((k) => k.titel.trim()).map((k) => {
          const uddrag = k.uddrag?.trim() ? k.uddrag.trim().slice(0, Math.min(MAX_EXCERPT_CHARS, budget)) : null;
          if (uddrag) budget -= uddrag.length;
          return { titel: k.titel, url: k.url ?? null, udgiver: k.udgiver ?? null, uddrag };
        });
      })(),
    };
  }, []);
  const ai = useEditorialAi({ articleId, getContext });

  // Production Engine: feedkort kan lægge en kilde (med uddrag) på den åbne artikel. Dubletter og loftet afvises med en forklaring.
  const addSourceFromFeed = useCallback((s: SourceDraft): AddSourceResult => {
    const current = formRef.current.meta.kilder;
    if (current.some((k) => (s.url && k.url === s.url) || k.titel.trim().toLowerCase() === s.titel.trim().toLowerCase())) return { ok: false, message: "Kilden er allerede på historien." };
    if (current.length >= META_LIMITS.kilder) return { ok: false, message: `Højst ${META_LIMITS.kilder} kilder pr. historie.` };
    setForm((f) => ({ ...f, meta: { ...f.meta, kilder: [...f.meta.kilder, { titel: s.titel, url: s.url ?? undefined, udgiver: s.udgiver, dato: s.dato, uddrag: s.uddrag, type: s.type, rating: null }] } }));
    return { ok: true, message: "Kilden er lagt på historien." };
  }, []);
  useRegisterSourceAdder(mode === "engine" ? addSourceFromFeed : null);

  // Giv AI-dockens chat artikelkonteksten (titel, underrubrik, brødtekst som ren tekst, sektion, geo, tags).
  useEditorBridge(() => {
    const f = formRef.current;
    return {
      artikelId: idRef.current,
      titel: f.titel,
      manchet: f.manchet,
      brodtekst: blocksPlainText(f.blocks).slice(0, 12000),
      sektion: options.categories.find((c) => c.id === f.kategoriId)?.navn ?? null,
      geo: options.geoTags.filter((g) => f.geoTagIds.includes(g.id)).map((g) => g.navn),
      tags: options.tags.filter((t) => f.tagIds.includes(t.id)).map((t) => t.navn),
    };
  });

  const blockedFor = useCallback(
    (task: EditorialTask) => (restricted && isTextGeneratingTask(task) ? "AI-tekstforslag er ikke tilladt i Krimi og retsvæsen samt Sundhed." : null),
    [restricted],
  );

  function accepted(task: EditorialTask, fn: () => void) {
    fn();
    const next = applyAcceptedAiUse(formRef.current.aiBrug, task);
    if (next.join("|") !== formRef.current.aiBrug.join("|")) {
      set("aiBrug", next);
      const added = next.filter((v) => !formRef.current.aiBrug.includes(v));
      setAiNotice(`AI-brug registreret under Mærkning og AI-brug: ${added.join(", ")}.`);
      setAiHighlight(true);
    }
  }

  const actions: SuggestionActions = {
    applyTitle: (titel) => accepted("headlines", () => onTitle(titel)),
    applyManchet: (manchet) => accepted("subheading", () => set("manchet", manchet)),
    applySlug: (slug) => { onSlug(slug); },
    applySeo: (v) => setForm((f) => ({ ...f, seoTitel: v.seoTitel, seoBeskrivelse: v.seoBeskrivelse })),
    applyOg: (v: TaskResult["og"]) => setMeta({ ogTitel: v.ogTitel, ogBeskrivelse: v.ogBeskrivelse, twitterTitel: v.twitterTitel, twitterBeskrivelse: v.twitterBeskrivelse }),
    applySocial: (platform: SocialPlatform, v) =>
      setForm((f) => {
        const current = f.meta.social[platform];
        return { ...f, meta: { ...f.meta, social: { ...f.meta.social, [platform]: { ...(current ?? {}), tekst: v.tekst, hashtags: v.hashtags, utm: current?.utm ?? defaultUtm(platform, f.slug || "artikel") } } } };
      }),
    applyTags: (names) => setForm((f) => ({ ...f, tagIds: Array.from(new Set([...f.tagIds, ...options.tags.filter((t) => names.includes(t.navn)).map((t) => t.id)])) })),
    applyGeo: (names) => setForm((f) => ({ ...f, geoTagIds: Array.from(new Set([...f.geoTagIds, ...options.geoTags.filter((t) => names.includes(t.navn)).map((t) => t.id)])) })),
    applySummary: (v) =>
      accepted("summary", () =>
        setForm((f) => ({
          ...f,
          blocks: [{ id: crypto.randomUUID(), type: "factbox", data: { title: "Kort fortalt", content: [v.tldr, ...v.punkter.map((p) => `• ${p}`)].join("\n") } }, ...f.blocks],
        })),
      ),
    applyTime: (hhmm) => {
      const now = new Date();
      const day = (d: Date) => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Copenhagen", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
      let iso = fromLocalInput(`${day(now)}T${hhmm}`);
      if (!iso || new Date(iso).getTime() <= now.getTime()) iso = fromLocalInput(`${day(new Date(now.getTime() + 24 * 3600 * 1000))}T${hhmm}`);
      set("planlagtTid", iso);
    },
  };

  const aiBundle: AiBundle = {
    enabled: flags.canUseAi,
    blocked: blockedFor,
    loading: (task) => ai.entries[task]?.status === "loading",
    run: (task, params) => void ai.run(task, params),
    tray: (task) => <SuggestionTray task={task} entry={ai.entries[task]} onDismiss={() => ai.dismiss(task)} actions={actions} />,
  };

  const blockAi: BlockAi = {
    enabled: flags.canUseAi,
    restrictedReason: restricted ? "AI-tekstforslag er ikke tilladt i Krimi og retsvæsen samt Sundhed." : null,
    entries: ai.entries,
    run: (task, params, key) => void ai.run(task, params, key),
    dismiss: ai.dismiss,
    onAccepted: (task) => accepted(task, () => undefined),
  };

  const sectionProps: SectionProps = { form, set, setMeta, options, flags, site, article, ai: aiBundle, score, seoInput, articleUrl, live };

  const statusClass = statusTone(article.status);
  const titleCount = charCount(form.titel, 110);
  const publishWarn = transitions.includes("Publiceret") && !score.complete;

  const body = (
    <>
      <div className="cms-ed-head">
        {mode === "panel" && closeHref && (
          <Link href={closeHref} className="cms-btn cms-btn-quiet cms-ed-back" scroll={false}><ArrowLeft size={16} aria-hidden="true" /> Til listen</Link>
        )}
        <div className="cms-ed-head-main">
          <span className={`cms-status cms-status-${statusClass}`}><span className="cms-status-dot" aria-hidden="true" /> {article.status}</span>
          {usesAi(form.aiBrug) && <AiChip>AI brugt: {aiUses.join(", ")}</AiChip>}
          <SaveIndicator state={shownState} onRetry={() => void runAutosave()} />
        </div>
        <div className="cms-ed-actions">
          {articleId ? (
            <a className="cms-btn cms-btn-secondary" href={`/redaktion/artikler/${articleId}/preview`} target="_blank" rel="noopener noreferrer" onClick={() => { if (formSignature(formRef.current) !== savedSig.current && !live) void runAutosave(); }}>
              <Eye size={16} aria-hidden="true" /> Vis preview
            </a>
          ) : (
            <button type="button" className="cms-btn cms-btn-secondary" disabled title="Skriv en titel — så gemmes kladden, og preview bliver tilgængelig.">
              <Eye size={16} aria-hidden="true" /> Vis preview
            </button>
          )}
          <button type="button" className="cms-btn cms-btn-primary" disabled={pending} onClick={() => submit(null)}>
            <Save size={16} aria-hidden="true" /> {pending ? "Gemmer…" : articleId ? "Opdater artikel" : "Gem artikel"}
          </button>
        </div>
      </div>

      <div className="cms-ed-alerts" aria-live="polite">
        {result.error && <div className="cms-alert is-error" role="alert"><TriangleAlert size={16} aria-hidden="true" /><div><strong>Artiklen kunne ikke gemmes</strong><p>{result.error}</p>{result.conflict && <button type="button" className="cms-btn cms-btn-secondary" onClick={() => window.location.reload()}>Genindlæs siden</button>}</div></div>}
        {saveState.kind === "conflict" && !result.error && <div className="cms-alert is-error" role="alert"><TriangleAlert size={16} aria-hidden="true" /><div><strong>Konflikt</strong><p>{saveState.message}</p><button type="button" className="cms-btn cms-btn-secondary" onClick={() => window.location.reload()}>Genindlæs siden</button></div></div>}
        {result.success && <div className="cms-alert is-ok" role="status"><div><strong>{result.success}</strong>{result.warnings && result.warnings.length > 0 && <details><summary>Metadata er ikke komplet ({result.warnings.length}) — artiklen er stadig gemt/publiceret</summary><ul>{result.warnings.map((w) => <li key={w}>{w}</li>)}</ul></details>}</div></div>}
        {aiNotice && <div className="cms-alert is-ai" role="status"><AiChip /> <p>{aiNotice}</p><button type="button" className="cms-icon-btn" aria-label="Luk" onClick={() => setAiNotice("")}><X size={16} aria-hidden="true" /></button></div>}
        <p className="cms-sr-only" role="status" aria-live="polite">{ai.announce}</p>
      </div>

      <div className="cms-ed-body">
        <div className="cms-field">
          <div className="cms-field-head">
            <label className="cms-label" htmlFor="titel">Titel</label>
            <span className="cms-field-tools">
              <CharCounter text={form.titel} max={110} />
              {flags.canUseAi && <SuggestButton label="Foreslå" loading={aiBundle.loading("headlines")} reason={blockedFor("headlines")} onClick={() => aiBundle.run("headlines")} />}
            </span>
          </div>
          <input id="titel" className="cms-input cms-input-title" value={form.titel} onChange={(e) => onTitle(e.target.value)} required aria-invalid={titleCount.over || undefined} aria-describedby="titel-help" />
          <p id="titel-help" className="cms-hint">Højst 110 tegn. Søgemaskiner viser ca. 60.</p>
          {result.fieldErrors?.titel?.map((e) => <p className="cms-hint is-warn" key={e} role="alert">{e}</p>)}
          {aiBundle.tray("headlines")}
        </div>

        <div className="cms-field">
          <div className="cms-field-head">
            <label className="cms-label" htmlFor="manchet">Underrubrik</label>
            <span className="cms-field-tools">
              <CharCounter text={form.manchet} max={220} />
              {flags.canUseAi && <SuggestButton label="Foreslå" loading={aiBundle.loading("subheading")} reason={blockedFor("subheading")} onClick={() => aiBundle.run("subheading")} />}
            </span>
          </div>
          <textarea id="manchet" className="cms-input" rows={2} value={form.manchet} onChange={(e) => set("manchet", e.target.value)} aria-describedby="manchet-help" />
          <p id="manchet-help" className="cms-hint">Højst 220 tegn. Bruges som metabeskrivelse, hvis ingen er skrevet.</p>
          {aiBundle.tray("subheading")}
        </div>

        <div className="cms-field">
          <span className="cms-label">Brødtekst</span>
          <BlockEditor blocks={form.blocks} onChange={(blocks) => set("blocks", blocks)} media={options.media} ai={blockAi} />
          <p className="cms-hint">{wordCount} ord · læsetid ca. {Math.max(1, Math.round(wordCount / 200))} min.</p>
        </div>

        <CoverField media={options.media} value={form.coverMediaId} onChange={(id) => set("coverMediaId", id)} />

        <div className="cms-grid-2">
          <div className="cms-field">
            <label className="cms-label" htmlFor="kategoriId">Sektion</label>
            <div className="cms-select-wrap">
              {category && <span className="cms-dot" data-tone={category.tone} aria-hidden="true" />}
              <select id="kategoriId" className="cms-select" value={form.kategoriId} onChange={(e) => set("kategoriId", e.target.value)}>
                <option value="">Vælg sektion</option>
                {options.categories.map((c) => <option key={c.id} value={c.id}>{c.navn}</option>)}
              </select>
            </div>
          </div>
          <div className="cms-field">
            <label className="cms-label" htmlFor="forfatter-main">Forfatter</label>
            <select id="forfatter-main" className="cms-select" value={form.forfatterId} onChange={(e) => set("forfatterId", e.target.value)}>
              <option value="">Vælg forfatter</option>
              {options.authors.map((a) => <option key={a.id} value={a.id}>{a.navn}</option>)}
            </select>
          </div>
        </div>

        <MultiPick id="tags" label="Tags" all={options.tags} selected={form.tagIds} onChange={(ids) => set("tagIds", ids)}
          action={flags.canUseAi && <SuggestButton label="Foreslå tags og områder" loading={aiBundle.loading("tagsGeo")} reason={blockedFor("tagsGeo")} onClick={() => aiBundle.run("tagsGeo")} />} />
        {aiBundle.tray("tagsGeo")}
        <MultiPick id="geo" label="By og områder" all={options.geoTags} selected={form.geoTagIds} onChange={(ids) => set("geoTagIds", ids)} />
      </div>

      <div className="cms-ed-accordions">
        <SeoSection {...sectionProps} />
        <SocialSection {...sectionProps} />
        <PlanningSection {...sectionProps} />
        <AiSection {...sectionProps} />
        {mode !== "engine" && <SourcesSection {...sectionProps} />}
        {mode !== "engine" && flags.canResearch && <KnowledgePanel key={site.base} articleId={articleId} title={form.titel} />}
        <MarkingSection {...sectionProps} aiRestricted={restricted} aiNone={aiNone} aiUses={aiUses} setAiBrug={(list) => { set("aiBrug", list); setAiHighlight(false); }} highlight={aiHighlight} hasUnverifiedSource={hasUnverifiedSource} />
        <AdvancedSection {...sectionProps} />
      </div>

      {transitions.length > 0 && (
        <section className="cms-ed-transitions" aria-label="Status">
          <h3 className="cms-subhead">Skift status</h3>
          {publishWarn && (
            <details className="cms-alert is-warn">
              <summary>Metadata er ikke komplet ({score.items.filter((i) => i.status !== "ok").length} punkter) — du kan stadig publicere</summary>
              <ul>{score.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
            </details>
          )}
          <div className="cms-row-actions">
            {transitions.map((status) => (
              <button key={status} type="button" className={status === "Publiceret" ? "cms-btn cms-btn-primary" : "cms-btn cms-btn-secondary"} disabled={pending || (status === "Publiceret" && !flags.canPublish)} onClick={() => submit(status)}>
                {status === "Publiceret" && <Send size={16} aria-hidden="true" />} {status}
              </button>
            ))}
          </div>
        </section>
      )}

      {children}
    </>
  );

  if (mode !== "engine" || !engine) return <div className="cms-ed" data-mode={mode}>{body}</div>;

  return (
    <div className="cms-ed cms-ed-engine" data-mode="engine">
      <div className="cms-ed-main eng-center">{body}</div>
      <aside className="eng-copilot" aria-label="Copilot">
        <EngineCopilot
          ctx={{
            articleId,
            titel: form.titel,
            manchet: form.manchet,
            bodyText,
            wordCount,
            restricted,
            flags,
            kilder: form.meta.kilder,
            setKilder: (kilder) => setMeta({ kilder }),
            score,
            profiles: engine.profiles,
            aiProvider: engine.aiProvider,
            ai: aiBundle,
            raw: ai,
            site,
            options,
          }}
        />
      </aside>
    </div>
  );
}

function MultiPick({ id, label, all, selected, onChange, action }: { id: string; label: string; all: Array<{ id: string; navn: string }>; selected: string[]; onChange: (ids: string[]) => void; action?: React.ReactNode }) {
  const remaining = all.filter((o) => !selected.includes(o.id));
  return (
    <div className="cms-field">
      <div className="cms-field-head"><label className="cms-label" htmlFor={`${id}-add`}>{label}</label><span className="cms-field-tools">{action}</span></div>
      <div className="cms-chips">
        {selected.map((sid) => {
          const o = all.find((x) => x.id === sid);
          return o ? <span key={sid} className="cms-chip">{o.navn}<button type="button" className="cms-chip-x" aria-label={`Fjern ${o.navn}`} onClick={() => onChange(selected.filter((x) => x !== sid))}><X size={12} aria-hidden="true" /></button></span> : null;
        })}
        <select id={`${id}-add`} className="cms-chip-select" value="" onChange={(e) => { if (e.target.value) onChange([...selected, e.target.value]); }} disabled={remaining.length === 0}>
          <option value="">{remaining.length ? "+ Tilføj" : "Alle valgt"}</option>
          {remaining.map((o) => <option key={o.id} value={o.id}>{o.navn}</option>)}
        </select>
      </div>
    </div>
  );
}
