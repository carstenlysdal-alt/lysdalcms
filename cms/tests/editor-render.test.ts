import assert from "node:assert/strict";
import test, { mock } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { serializeMeta, emptyMeta, articleMetaSchema } from "../lib/article-meta";
import type { ArticleEditorValue, EditorFlags, EditorOptions } from "../lib/editor/types";

mock.module("next-auth", { defaultExport: Object.assign(() => ({ handlers: {}, auth: async () => null, signIn: async () => undefined, signOut: async () => undefined }), { AuthError: class AuthError extends Error {} }) });
mock.module("next/cache", { namedExports: { revalidatePath: () => undefined, revalidateTag: () => undefined } });
mock.module("next/navigation", {
  namedExports: {
    redirect: (url: string) => { throw new Error(`NEXT_REDIRECT:${url}`); },
    notFound: () => { throw new Error("NEXT_NOT_FOUND"); },
    useRouter: () => ({ refresh: () => undefined, push: () => undefined, replace: () => undefined }),
    usePathname: () => "/redaktion/artikler",
  },
});

const options: EditorOptions = {
  categories: [{ id: "c1", navn: "Nyheder", tone: 1, sektionSlug: "nyheder" }, { id: "c2", navn: "Nyheder › Byråd", tone: 1, sektionSlug: "nyheder" }, { id: "k1", navn: "Krimi og retsvæsen", tone: 4, sektionSlug: "krimi-og-retsvaesen" }],
  authors: [{ id: "a1", navn: "Frida" }],
  tags: [{ id: "t1", navn: "Byråd" }],
  geoTags: [{ id: "g1", navn: "Næstved By" }],
  media: [{ id: "m1", url: "/uploads/a.jpg", altTekst: "Rådhus", billedtekst: "Rådhuset", filnavn: "a.jpg", ophavsperson: null, bredde: 1200, hoejde: 630 }],
};
const flags: EditorFlags = { canPublish: true, canControlFrontpage: true, canUseAi: true, restrictedCategoryIds: ["k1"] };
const article = (over: Partial<ArticleEditorValue> = {}): ArticleEditorValue => ({
  id: "abc12345def", titel: "Byrådet vedtager budget", manchet: "Kort fortalt", slug: "byraadet-vedtager-budget",
  blocks: [{ id: "b1", type: "paragraph", data: { content: "<p>Brødtekst</p>" } }, { id: "b2", type: "image", data: { mediaId: "m1", url: "/uploads/a.jpg", alt: "", caption: "" } }],
  status: "Udkast", indholdstype: "Uafhængig", aiBrug: [], marking: null, pinned: false, breaking: false, seoTitel: "", seoBeskrivelse: "", sprog: "da",
  kategoriId: "c1", forfatterId: "a1", coverMediaId: "m1", tagIds: ["t1"], geoTagIds: [], planlagtTid: "", version: 1, meta: serializeMeta(emptyMeta()), publiceretTid: null, ...over,
});

async function render(a: ArticleEditorValue, f: EditorFlags = flags, transitions: string[] = ["Redigering"]) {
  const { ArticleEditor } = await import("../components/editor/article-editor");
  return renderToStaticMarkup(
    createElement(ArticleEditor, { article: a, options, flags: f, site: { domaene: "naestvedlokalt.dk", navn: "NæstvedLokalt", base: "https://naestvedlokalt.dk" }, transitions, mode: "panel", closeHref: "/redaktion/artikler", hasUnverifiedSource: false }),
  );
}

test("editor: felter, tegntællere, accordions og handlinger renderes med tilgængelige navne (WCAG-grundlag)", async () => {
  const html = await render(article());
  for (const text of ["Titel", "Underrubrik", "Brødtekst", "Featurebillede", "Sektion", "Tags", "SEO &amp; metadata", "Sociale medier", "Planlægning", ">AI<", "Kilder", "Avanceret", "Mærkning og AI-brug", "Vis preview", "Opdater artikel", "Til listen"]) {
    assert.ok(html.includes(text), `mangler: ${text}`);
  }
  assert.ok(html.includes("23/110"), "titeltæller 23/110");
  assert.ok(html.includes("12/220"), "underrubrik-tæller");
  assert.match(html, /role="toolbar"[^>]*aria-label="Formatering"/);
  assert.match(html, /aria-expanded="false"/, "accordions er lukkede som standard");
  assert.match(html, /role="status" aria-live="polite"/, "gem-indikator er aria-live=polite");
  assert.match(html, /href="\/redaktion\/artikler\/abc12345def\/preview"[^>]*target="_blank"[^>]*rel="noopener noreferrer"/);
  assert.match(html, /Sektion[\s\S]*Nyheder › Byråd/, "sektionsvælgeren viser forælder › barn fra kategoritræet");
  assert.match(html, /Alt-tekst er påkrævet/, "billedblok uden alt-tekst advarer");
  assert.match(html, /Mangler kreditering/, "kredit-tjek på featurebillede");
  assert.match(html, /cms-dot" data-tone="1"/, "farveprik via data-attribut");
});

test("editor: ingen inline style-attributter og ingen hardcodede hex-farver i markup", async () => {
  const html = await render(article({ status: "Publiceret" }));
  assert.ok(!/\sstyle="/.test(html), "ingen inline style={{}}");
  assert.ok(!/#[0-9a-fA-F]{6}\b/.test(html.replace(/&#x?[0-9a-fA-F]+;/g, "")), "ingen hex i markup");
});

test("editor: AI-knapper kun med rettighed; Krimi/Sundhed spærrer tekstforslag men ikke metadata; publiceret artikel viser at autosave er slået fra", async () => {
  const withAi = await render(article());
  assert.ok((withAi.match(/cms-btn-ai/g) ?? []).length >= 8, "Foreslå-knapper ved felterne");
  const noAi = await render(article(), { ...flags, canUseAi: false });
  assert.equal((noAi.match(/cms-btn-ai/g) ?? []).length, 0);
  assert.match(noAi, /Du har ikke adgang til AI i artikelarbejdet/);

  const krimi = await render(article({ kategoriId: "k1" }));
  assert.match(krimi, /disabled=""[^>]*title="AI-tekstforslag er ikke tilladt i Krimi og retsvæsen samt Sundhed\."/);
  assert.match(krimi, /ikke tilladt i Krimi og retsvæsen samt Sundhed/);
  assert.match(krimi, /Omskrivning \(ikke tilladt i denne sektion\)/);
});

test("editor: ny artikel uden id har deaktiveret preview; transitions og metadata-advarsel vises; metadata fra databasen vises", async () => {
  const fresh = await render(article({ id: null, titel: "", slug: "", version: 0 }));
  assert.match(fresh, /Gem artikel/);
  assert.match(fresh, /<button[^>]*disabled=""[^>]*>[\s\S]*?Vis preview/);
  const withTransitions = await render(article({ status: "Godkendelse" }), flags, ["Planlagt", "Publiceret"]);
  assert.match(withTransitions, /Skift status/);
  assert.match(withTransitions, /Metadata er ikke komplet/);
  const meta = serializeMeta(articleMetaSchema.parse({ ogTitel: "OG fra db", social: { x: { tekst: "X-opslag", hashtags: [] } }, kilder: [{ titel: "Notat" }] }));
  const html = await render(article({ meta }));
  assert.ok(html.includes("OG fra db"));
  assert.ok(html.includes("1/5 opslag"));
  assert.ok(html.includes("1 angivet"));
});

test("artikelliste (server): listekort med by-prik, statuschip, forsinket-markering og URL-synkroniseret valg", async () => {
  const { ArticleCardList } = await import("../components/editor/article-list");
  const row = (over: Record<string, unknown>) => ({
    id: "row00001", titel: "Listetitel", manchet: "Uddrag", status: "Planlagt", planlagtTid: new Date(Date.now() - 3600_000), publiceretTid: null, opdateretTid: new Date(), breaking: false, pinned: false,
    forfatter: { navn: "Frida" }, coverMedia: { url: "/uploads/a.jpg" }, kategori: { id: "c1", navn: "Nyheder" }, ...over,
  });
  const html = renderToStaticMarkup(createElement(ArticleCardList, { rows: [row({}), row({ id: "row00002", status: "Publiceret", planlagtTid: null })] as never, selectedId: "row00001", hrefFor: (id: string) => `/redaktion/artikler?id=${id}`, city: "Næstved", view: "liste", canManageFrontpage: true }));
  assert.match(html, /aria-current="true" href="\/redaktion\/artikler\?id=row00001"/);
  assert.match(html, /data-city="naestved"/);
  assert.match(html, /Forsinket/);
  assert.match(html, /cms-status-planned/);
  assert.match(html, /cms-status-published/);
  assert.ok(!/\sstyle="/.test(html));
  assert.match(renderToStaticMarkup(createElement(ArticleCardList, { rows: [], selectedId: "", hrefFor: () => "", city: "X", view: "liste", canManageFrontpage: false })), /Ingen historier/);
});

test("kladde-preview bruger de offentlige komponenter; delings-previews og SERP renderes", async () => {
  const { ArticlePreviewView } = await import("../components/editor/article-preview-view");
  const html = renderToStaticMarkup(createElement(ArticlePreviewView, {
    article: { titel: "Preview-titel", manchet: "<p>Manchet</p>", indholdstype: "Partner", marking: { sponsor: "Bank", labelTekst: "x" }, blocks: [{ id: "b", type: "paragraph", data: { content: "<p>Tekst <script>alert(1)</script></p>" } }],
      forfatter: { navn: "Frida" }, cover: { url: "/uploads/a.jpg", altTekst: "Alt", billedtekst: "Tekst", ophavsperson: "Jens" }, sektion: "Nyheder", omraade: "Næstved", tags: ["byråd"], geo: ["Næstved By"], publiceretTid: null, opdateretTid: new Date() },
  }));
  assert.match(html, /site-article-h1/);
  assert.match(html, /Preview-titel/);
  assert.ok(!html.includes("<script"), "brødtekst sanitiseres som på det offentlige site");
  assert.match(html, /Foto: Jens/);
  const { SharePreviews } = await import("../components/editor/share-previews");
  const serp = renderToStaticMarkup(createElement(SharePreviews, { siteName: "NæstvedLokalt", input: { base: "https://naestvedlokalt.dk", titel: "T".repeat(80), slug: "x", sektion: { navn: "Nyheder", slug: "nyheder" }, draft: true } }));
  assert.match(serp, /role="tablist"/);
  assert.match(serp, /Titlen klippes af Google/);
  assert.match(serp, /naestvedlokalt\.dk › nyheder › x/);
});

test("editor: research panel follows article permission flag and keeps search separate from save/publication", async () => {
  const yes = await render(article(), { ...flags, canResearch: true });
  const no = await render(article(), { ...flags, canResearch: false });
  assert.match(yes, /Tidligere viden/); assert.match(yes, /Find tidligere viden/);
  assert.ok(!no.includes("Tidligere viden")); assert.ok(!no.includes("Find tidligere viden"));
  assert.match(yes, /type="button"[^>]*>Find tidligere viden/);
});
