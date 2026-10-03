import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import { articleMetaSchema, metaFromRow, metaToDb, serializeMeta } from "../lib/article-meta";
import { db } from "../lib/db";
import { MemoryRateLimitStore, setRateLimitStore } from "../lib/ratelimit";
import { resolveSeoConfig } from "../lib/seo/config";
import { newsArticleNode } from "../lib/seo/jsonld";
import { siteBase } from "../lib/seo/url";
import { createInstance, createUser, installNextMocks, session } from "./helpers/mock-session";

installNextMocks();

type Feed = typeof import("../lib/engine/feed");
type Start = typeof import("../lib/engine/start");
type Material = typeof import("../lib/engine/material");
let feed: Feed;
let start: Start;
let material: Material;
let instansId = "";
let otherId = "";
let editor: Awaited<ReturnType<typeof createUser>>;
let community: Awaited<ReturnType<typeof createUser>>;
let support: Awaited<ReturnType<typeof createUser>>;
let otherEditor: Awaited<ReturnType<typeof createUser>>;
const ids: Record<string, string> = {};

const POLITI_TEKST = "Mindst fem erhvervslejemål og lagre er blevet brudt op natten til tirsdag mellem kl. 01:30 og 04:00. Tyvene stjal udstyr for over 400.000 kr.";

before(async () => {
  setRateLimitStore(new MemoryRateLimitStore());
  feed = await import("../lib/engine/feed");
  start = await import("../lib/engine/start");
  material = await import("../lib/engine/material");
  instansId = (await createInstance("En")).id;
  otherId = (await createInstance("EnAndet")).id;
  editor = await createUser(instansId, "Ansvarshavende redaktør");
  community = await createUser(instansId, "Community manager");
  support = await createUser(instansId, "Støtte");
  otherEditor = await createUser(otherId, "Ansvarshavende redaktør");

  const geo = await db.geoTag.create({ data: { instansId, navn: "Næstved By", slug: "naestved-by" } });
  await db.geoTag.create({ data: { instansId, navn: "Karrebæksminde", slug: "karrebaeksminde" } });
  ids.krimi = (await db.category.create({ data: { instansId, navn: "Krimi og retsvæsen", slug: "krimi-og-retsvaesen" } })).id;
  ids.politik = (await db.category.create({ data: { instansId, navn: "Politik", slug: "politik" } })).id;
  ids.nyheder = (await db.category.create({ data: { instansId, navn: "Nyheder", slug: "nyheder" } })).id;

  ids.politi = (await db.signal.create({ data: { instansId, overskrift: "Politi efterlyser vidner efter indbrudsbølge på Havnegade", brødtekst: POLITI_TEKST, kilde: "Sydsjællands Politi", kildeUrl: "https://politi.dk/sydsjaelland/døgnrapport", sourceType: "politi", maskinindsamlet: true, omraadeId: geo.id } })).id;
  ids.dagsorden = (await db.signal.create({ data: { instansId, overskrift: "Byrådet behandler ny lokalplan for havnen", brødtekst: "Dagsorden punkt 4.", kilde: "Næstved Kommune", sourceType: "kommune_dagsorden", maskinindsamlet: true } })).id;
  ids.manuelt = (await db.signal.create({ data: { instansId, overskrift: "Tip fra redaktionen om havnen", kilde: "Intern", notable: true } })).id;
  ids.fremmed = (await db.signal.create({ data: { instansId: otherId, overskrift: "Fremmed indbrudsbølge på havnen", kilde: "Ritzau" } })).id;

  await db.submission.create({ data: { instansId, navn: "Lotte Hansen", kontakt: "lotte@example.dk", emne: "Vejlukning ved Kildemarkskolen", tekst: "Der er kaos i myldretiden ved skolen.", omraadeId: geo.id } });
  await db.submission.create({ data: { instansId: otherId, navn: "Fremmed", kontakt: "x@example.dk", emne: "Fremmed tip om vejlukning", tekst: "Skal ikke ses." } });
  const meddeler = await db.meddelerProfile.create({ data: { instansId, navn: "Hemmelig Kilde", kontakt: "k@example.dk", omraader: "Næstved By" } });
  await db.meddelerSag.create({ data: { instansId, meddelerId: meddeler.id, titel: "Brand i industrikvarter", tekst: "Meddeleren har set røg." } });

  const body = (t: string) => [{ id: "p1", type: "paragraph", data: { content: `<p>${t}</p>` } }];
  ids.pubA = (await db.article.create({ data: { instansId, titel: "Indbrud ved havnekajen i Næstved", slug: "indbrud-havnekajen", manchet: "Tyve slog til mod flere virksomheder ved havnen", blocks: body("Politiet efterforsker indbrud ved havnekajen, hvor flere lagre blev ramt."), aiBrug: [], status: "Publiceret", publiceretTid: new Date("2026-09-01T08:00:00Z"), kategoriId: ids.nyheder } })).id;
  ids.pubB = (await db.article.create({ data: { instansId, titel: "Ny bager åbner i Slagelse", slug: "ny-bager", manchet: "Boller og brød", blocks: body("Bageren åbner på lørdag."), aiBrug: [], status: "Publiceret", publiceretTid: new Date("2026-09-02T08:00:00Z"), kategoriId: ids.nyheder } })).id;
  ids.draft = (await db.article.create({ data: { instansId, titel: "Kladde om havnen", slug: "kladde-havnen", manchet: "Ikke publiceret", blocks: body("Intern kladde."), aiBrug: [], status: "Idé" } })).id;
});

after(async () => {
  for (const id of [instansId, otherId]) {
    await db.auditLog.deleteMany({ where: { instansId: id } });
    await db.articleMeta.deleteMany({ where: { instansId: id } });
    await db.article.deleteMany({ where: { instansId: id } });
    await db.signal.deleteMany({ where: { instansId: id } });
    await db.submission.deleteMany({ where: { instansId: id } });
    await db.meddelerSag.deleteMany({ where: { instansId: id } });
    await db.meddelerProfile.deleteMany({ where: { instansId: id } });
    await db.sourceProfile.deleteMany({ where: { instansId: id } });
    await db.geoTag.deleteMany({ where: { instansId: id } });
    await db.category.deleteMany({ where: { instansId: id } });
    await db.user.deleteMany({ where: { instansId: id } });
    await db.instance.delete({ where: { id } });
  }
});

async function authorized(u: { id: string }) {
  const { getAuthorizedUser } = await import("../lib/auth");
  session.userId = u.id;
  const user = await getAuthorizedUser();
  assert.ok(user);
  return user!;
}

// ── Start en historie fra et signal ──────────────────────────────────────────

test("start fra signal: kladde med signalet som kilde (inkl. uddrag), tom brødtekst, Krimi for politi, signal markeres læst", async () => {
  const user = await authorized(editor);
  const res = await start.startArticleFromSignal(user, ids.politi);
  assert.equal(res.ok, true);
  if (!res.ok) return;
  assert.equal(res.findesAllerede, false);

  const article = await db.article.findUniqueOrThrow({ where: { id: res.articleId }, include: { meta: true, geoTags: true } });
  assert.equal(article.status, "Idé");
  assert.equal(article.indholdstype, "Uafhængig");
  assert.deepEqual(article.aiBrug, []);
  assert.equal(article.kategoriId, ids.krimi, "politi lægges i Krimi, så AI-tekstforslag er spærret");
  assert.equal(article.forfatterId, user.authorId);
  assert.deepEqual(article.blocks, [{ id: "initial-paragraph", type: "paragraph", data: { content: "" } }], "signalets tekst kopieres ikke ind i brødteksten");
  assert.deepEqual(article.geoTags.map((g) => g.navn), ["Næstved By"]);
  assert.equal(article.externalId, `engine:signal:${ids.politi}`);

  const meta = metaFromRow(article.meta as never);
  assert.equal(meta.kilder.length, 1);
  assert.equal(meta.kilder[0].udgiver, "Sydsjællands Politi");
  assert.equal(meta.kilder[0].type, "politi");
  assert.equal(meta.kilder[0].uddrag, POLITI_TEKST);
  assert.equal(meta.kilder[0].url, "https://politi.dk/sydsjaelland/døgnrapport");
  assert.match(meta.kilder[0].dato ?? "", /^\d{4}-\d{2}-\d{2}$/);

  assert.equal((await db.signal.findUniqueOrThrow({ where: { id: ids.politi } })).laest, true);
  assert.ok(await db.auditLog.findFirst({ where: { instansId, action: "engine.start", targetId: res.articleId } }));

  // Idempotent: samme signal giver samme artikel, ingen dublet
  const again = await start.startArticleFromSignal(user, ids.politi);
  assert.deepEqual(again, { ok: true, articleId: res.articleId, findesAllerede: true });
  assert.equal(await db.article.count({ where: { instansId, externalId: `engine:signal:${ids.politi}` } }), 1);
});

test("start fra signal: kommunalt signal lægges i Politik, og et signal uden passende kategori giver ingen kategori", async () => {
  const user = await authorized(editor);
  const k = await start.startArticleFromSignal(user, ids.dagsorden);
  assert.equal(k.ok && (await db.article.findUniqueOrThrow({ where: { id: k.articleId } })).kategoriId, ids.politik);
  assert.deepEqual(start.categorySlugsFor("politi"), ["krimi-og-retsvaesen", "112"]);
  assert.deepEqual(start.categorySlugsFor(null), ["nyheder"]);
  const m = await start.startArticleFromSignal(user, ids.manuelt);
  assert.equal(m.ok && (await db.article.findUniqueOrThrow({ where: { id: m.articleId } })).kategoriId, ids.nyheder);
});

test("start fra signal: kræver article.create og er afgrænset til brugerens by", async () => {
  const denied = await start.startArticleFromSignal(await authorized(support), ids.manuelt);
  assert.equal(denied.ok, false);
  const foreign = await start.startArticleFromSignal(await authorized(editor), ids.fremmed);
  assert.deepEqual(foreign, { ok: false, error: "Signalet findes ikke." });
  assert.equal(await db.article.count({ where: { instansId, externalId: `engine:signal:${ids.fremmed}` } }), 0);
  assert.equal(await db.article.count({ where: { instansId: otherId } }), 0);
});

// ── Feed ─────────────────────────────────────────────────────────────────────

test("feed: signaler for egen by med rating, markering af igangsatte historier og tællere", async () => {
  const user = await authorized(editor);
  const data = await feed.loadFeed(user, { tab: "feeds" });
  const titles = data.cards.map((c) => c.overskrift);
  assert.ok(titles.includes("Politi efterlyser vidner efter indbrudsbølge på Havnegade"));
  assert.ok(!titles.some((t) => t.includes("Fremmed")), "signaler fra en anden by ses ikke");
  const politi = data.cards.find((c) => c.id === `signal:${ids.politi}`)!;
  assert.equal(politi.rating.grade, "A");
  assert.equal(politi.rating.foelsom, true);
  assert.equal(politi.hoej, true);
  assert.equal(politi.maskinindsamlet, true);
  assert.ok(politi.articleId, "historien er allerede startet");
  const manuelt = data.cards.find((c) => c.id === `signal:${ids.manuelt}`)!;
  assert.equal(manuelt.rating.grade, "C");
  assert.equal(manuelt.hoej, true, "notable giver høj prioritet");
  assert.equal(data.counts.signaler, 3);
  assert.equal(data.counts.tips, 2);
  assert.equal(data.sync.maskin24t, 2);
  assert.ok(data.sync.sidsteMaskinSignalIso);
  assert.deepEqual(data.omraader.map((o) => o.slug), ["karrebaeksminde", "naestved-by"]);
});

test("feed: områdefilter, og kilderegisteret ændrer ratingen", async () => {
  const user = await authorized(editor);
  const naestved = await feed.loadFeed(user, { tab: "feeds", omraade: "naestved-by" });
  assert.deepEqual(naestved.cards.map((c) => c.id), [`signal:${ids.politi}`]);
  assert.deepEqual((await feed.loadFeed(user, { tab: "feeds", omraade: "karrebaeksminde" })).cards, []);

  await db.sourceProfile.create({ data: { instansId, navn: "Intern", type: "andet", score: 85 } });
  const after = await feed.loadFeed(user, { tab: "feeds" });
  assert.equal(after.cards.find((c) => c.id === `signal:${ids.manuelt}`)!.rating.grade, "A", "registerets score går forud for standarden");
  await db.sourceProfile.deleteMany({ where: { instansId } });
});

test("feed: tip viser aldrig kontaktoplysninger, og meddelerens navn kun med rettigheden Se fortrolige kilder", async () => {
  const lead = await feed.loadFeed(await authorized(editor), { tab: "tips" });
  const blob = JSON.stringify(lead);
  assert.ok(!blob.includes("lotte@example.dk") && !blob.includes("k@example.dk"), "ingen e-mails i feedet");
  assert.ok(!blob.includes("Fremmed tip"), "tip fra anden by ses ikke");
  assert.ok(lead.cards.some((c) => c.kind === "meddeler" && c.kilde === "Hemmelig Kilde"), "redaktøren har rettigheden");
  assert.ok(lead.cards.some((c) => c.kind === "borgertip" && c.rating.grade === "D"));

  const cm = await feed.loadFeed(await authorized(community), { tab: "tips" });
  assert.ok(!JSON.stringify(cm).includes("Hemmelig Kilde"), "community manager har ikke rettigheden");
  assert.ok(cm.cards.some((c) => c.kind === "meddeler" && c.kilde === "Meddeler"));
  assert.ok(!JSON.stringify(cm).includes("Lotte"), "borgerens navn vises aldrig i feedet");
});

test("arkiv: emneoverlap finder relevante artikler, ekskluderer den åbne og ikke-publicerede", async () => {
  const user = await authorized(editor);
  const hits = await feed.loadArchiveMatches(user, { query: "Indbrudsbølge ved havnekajen i Næstved: politiet efterlyser vidner" });
  assert.deepEqual(hits.map((h) => h.articleId), [ids.pubA]);
  assert.ok(hits[0].match! >= 25);
  assert.equal(hits[0].kind, "arkiv");
  assert.deepEqual(await feed.loadArchiveMatches(user, { query: "" }), [], "uden tekst ingen match");
  assert.deepEqual(await feed.loadArchiveMatches(user, { query: "Indbrudsbølge ved havnekajen i Næstved", articleId: ids.pubA }), [], "den åbne artikel udelades");
  const viaArticle = await feed.loadArchiveMatches(user, { articleId: ids.draft });
  assert.ok(Array.isArray(viaArticle));
  const other = await feed.loadArchiveMatches(await authorized(otherEditor), { query: "Indbrudsbølge ved havnekajen i Næstved" });
  assert.deepEqual(other, [], "en anden by ser ikke arkivet");
});

// ── Materialesøgning og kilder ───────────────────────────────────────────────

test("materialesøgning: finder på tværs, kun egen by, og kræver 2 tegn og article.create", async () => {
  const user = await authorized(editor);
  const res = await material.searchMaterial(user, "havn");
  assert.equal(res.ok, true);
  if (!res.ok) return;
  const kinds = new Set(res.hits.map((h) => h.kind));
  assert.ok(kinds.has("artikel") && kinds.has("signal"));
  assert.ok(!res.hits.some((h) => h.titel.includes("Fremmed")), "intet fra en anden by");
  assert.ok(res.hits.every((h) => !h.meta.includes("@")), "ingen kontaktoplysninger");
  const draft = res.hits.find((h) => h.id === `artikel:${ids.draft}`)!;
  assert.equal(draft.kanBruges, false, "ikke-publicerede artikler kan ikke bruges som kilde");
  assert.equal(res.hits.find((h) => h.id === `artikel:${ids.pubA}`)!.kanBruges, true);

  assert.equal((await material.searchMaterial(user, "h")).ok, false);
  assert.equal((await material.searchMaterial(await authorized(support), "havn")).ok, false);
  const tip = await material.searchMaterial(user, "vejlukning");
  assert.ok(tip.ok && tip.hits.some((h) => h.kind === "tip") && !tip.hits.some((h) => h.titel.includes("Fremmed")));
});

test("kilde fra materiale: signal med uddrag og publiceret artikel med URL; fremmede og kladder afvises", async () => {
  const user = await authorized(editor);
  const s = await material.sourceFromMaterial(user, `signal:${ids.politi}`);
  assert.ok(s.ok);
  if (s.ok) {
    assert.equal(s.kilde.uddrag, POLITI_TEKST);
    assert.equal(s.kilde.type, "politi");
    assert.equal(s.kilde.udgiver, "Sydsjællands Politi");
  }
  const a = await material.sourceFromMaterial(user, `artikel:${ids.pubA}`);
  assert.ok(a.ok);
  if (a.ok) {
    assert.match(a.kilde.url ?? "", /^https:\/\/.+\/nyheder\/indbrud-havnekajen$/);
    assert.equal(a.kilde.type, "egen");
    assert.match(a.kilde.uddrag ?? "", /flere lagre blev ramt/);
  }
  const arkiv = await material.sourceFromMaterial(user, `arkiv:${ids.pubA}`);
  assert.ok(arkiv.ok, "arkivkort bruges som artikel");
  assert.equal((await material.sourceFromMaterial(user, `artikel:${ids.draft}`)).ok, false);
  assert.equal((await material.sourceFromMaterial(user, `signal:${ids.fremmed}`)).ok, false);
  assert.equal((await material.sourceFromMaterial(user, `tip:${ids.politi}`)).ok, false);
  assert.equal((await material.sourceFromMaterial(await authorized(support), `signal:${ids.politi}`)).ok, false);
});

// ── Interne kildefelter udgives aldrig ───────────────────────────────────────

test("kilder: uddrag, type og rating gemmes og læses igen, men når aldrig den offentlige JSON-LD", () => {
  const meta = articleMetaSchema.parse({
    kilder: [{ titel: "Døgnrapport", url: "https://politi.dk/rapport", udgiver: "Politiet", dato: "2026-10-01", uddrag: "FORTROLIGT UDDRAG TIL FAKTATJEK", type: "politi", rating: "A" }],
  });
  const row = metaToDb(meta);
  const back = metaFromRow({ ...row, id: "x", articleId: "y", instansId: "z", createdAt: new Date(), updatedAt: new Date() } as never);
  assert.equal(back.kilder[0].uddrag, "FORTROLIGT UDDRAG TIL FAKTATJEK");
  assert.equal(back.kilder[0].rating, "A");
  assert.equal(serializeMeta(back).kilder[0].type, "politi");

  const site = { domaene: "naestvedlokalt.dk", navn: "NæstvedLokalt", kommune: "Næstved", tagline: "Din lokale stemme" };
  const cfg = resolveSeoConfig({ ...site, logoUrl: null, sideTekster: null }, {} as NodeJS.ProcessEnv);
  const node = newsArticleNode(
    { titel: "Test", slug: "test", indholdstype: "Uafhængig", sektion: { navn: "Nyheder", slug: "nyheder" }, meta: { ...back, kilder: back.kilder } },
    site,
    cfg,
    siteBase(site),
  );
  const json = JSON.stringify(node);
  assert.ok(json.includes("Døgnrapport"), "titlen er offentlig");
  assert.ok(!json.includes("FORTROLIGT UDDRAG"), "uddraget udgives aldrig");
  assert.ok(!json.includes('"rating"') && !json.includes('"uddrag"'));

  assert.equal(articleMetaSchema.safeParse({ kilder: [{ titel: "X", rating: "E" }] }).success, false, "ugyldig karakter afvises");
  assert.equal(articleMetaSchema.safeParse({ kilder: [{ titel: "X", uddrag: "x".repeat(4001) }] }).success, false, "uddrag højst 4000 tegn");
  assert.deepEqual(articleMetaSchema.parse({ kilder: [{ titel: "Uden ekstra" }] }).kilder, [{ titel: "Uden ekstra" }], "eksisterende kilder uden de nye felter er uændrede");
});

test("start fra signal: en kilde-URL, som metadata afviser, giver en kladde uden URL i stedet for en fejl", async () => {
  const user = await authorized(editor);
  const bad = await db.signal.create({ data: { instansId, overskrift: "Signal med ødelagt kilde-URL", brødtekst: "Tekst om havnen.", kilde: "Lokal kilde", kildeUrl: `https://eksempel.dk/${"a".repeat(2100)}` } });
  const res = await start.startArticleFromSignal(user, bad.id);
  assert.equal(res.ok, true);
  if (!res.ok) return;
  const row = await db.article.findUniqueOrThrow({ where: { id: res.articleId }, include: { meta: true } });
  const meta = metaFromRow(row.meta as never);
  assert.equal(meta.kilder.length, 1);
  assert.equal(meta.kilder[0].url, undefined, "URL'en droppes");
  assert.equal(meta.kilder[0].uddrag, "Tekst om havnen.", "titel og uddrag bevares");
});
