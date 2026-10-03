import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import { db } from "../lib/db";
import { createInstance, createUser, installNextMocks, session, uniq } from "./helpers/mock-session";

installNextMocks();

type Actions = typeof import("../app/redaktion/artikler/actions");
type ForsideActions = typeof import("../app/redaktion/forside/actions");
let actions: Actions;
let forside: ForsideActions;
let instansId = "";
let authorId = "";
let categoryPolitikId = "";
let categoryKrimiChildId = "";
let freelancer: { id: string };
let editor: { id: string; navn: string };
let leader: { id: string };
const created: string[] = [];

const BLOCKS = JSON.stringify([{ id: "b1", type: "paragraph", data: { content: "<p>Tekst</p>" } }]);

function form(fields: Record<string, string | string[]>) {
  const fd = new FormData();
  const base: Record<string, string | string[]> = { titel: "Testartikel om byrådet", slug: uniq("slug").replace(/[^a-z0-9-]/g, "-"), indholdstype: "Uafhængig", sprog: "da", blocks: BLOCKS };
  for (const [k, v] of Object.entries({ ...base, ...fields })) for (const x of Array.isArray(v) ? v : [v]) fd.append(k, x);
  return fd;
}

async function makeArticle(over: Record<string, unknown> = {}) {
  const a = await db.article.create({
    data: { titel: "Eksisterende", slug: uniq("art"), blocks: JSON.parse(BLOCKS), aiBrug: [], status: "Godkendelse", instansId, forfatterId: authorId, ...over },
  });
  created.push(a.id);
  return a;
}

const as = (u: { id: string } | null) => { session.userId = u?.id ?? null; };

before(async () => {
  actions = await import("../app/redaktion/artikler/actions");
  forside = await import("../app/redaktion/forside/actions");
  const inst = await createInstance("Art");
  instansId = inst.id;
  const author = await db.author.create({ data: { navn: "Frida Freelance", instansId } });
  authorId = author.id;
  freelancer = await createUser(instansId, "Freelancejournalist", { authorId });
  editor = await createUser(instansId, "Ansvarshavende redaktør");
  leader = await createUser(instansId, "Redaktionsleder");
  categoryPolitikId = (await db.category.create({ data: { instansId, navn: "Politik", slug: "politik" } })).id;
  const krimi = await db.category.create({ data: { instansId, navn: "Krimi og retsvæsen", slug: "krimi-og-retsvaesen" } });
  // Barnet har hverken 'krimi' i navn eller slug — spærringen skal følge forældrekæden (id-træet).
  categoryKrimiChildId = (await db.category.create({ data: { instansId, navn: "Lokale sager", slug: "lokale-sager", parentId: krimi.id } })).id;
});

after(async () => {
  await db.correction.deleteMany({ where: { instansId } });
  await db.articleRevision.deleteMany({ where: { article: { instansId } } });
  await db.honorEntry.deleteMany({ where: { instansId } });
  await db.frontpagePlacement.deleteMany({ where: { instansId } });
  await db.article.deleteMany({ where: { instansId } });
  await db.category.deleteMany({ where: { instansId, parentId: { not: null } } });
  await db.category.deleteMany({ where: { instansId } });
  await db.author.updateMany({ where: { instansId }, data: {} });
  await db.user.deleteMany({ where: { instansId } });
  await db.author.deleteMany({ where: { instansId } });
  await db.instance.delete({ where: { id: instansId } });
});

test("T5 P2-4: kun FRONTPAGE_EDIT kan sætte pinned/breaking; andre bevarer den eksisterende værdi", async () => {
  const art = await makeArticle({ status: "Idé" });
  as(freelancer);
  const r = await actions.saveArticle(art.id, {}, form({ slug: art.slug, pinned: "on", breaking: "on", aiBrug: "Ingen" }));
  assert.equal(r.error, undefined);
  let row = await db.article.findUniqueOrThrow({ where: { id: art.id } });
  assert.equal(row.pinned, false, "forfatter kan ikke fastgøre");
  assert.equal(row.breaking, false, "forfatter kan ikke sætte breaking");

  as(editor);
  assert.equal((await actions.saveArticle(art.id, {}, form({ slug: art.slug, pinned: "on", breaking: "on", aiBrug: "Ingen" }))).error, undefined);
  row = await db.article.findUniqueOrThrow({ where: { id: art.id } });
  assert.equal(row.pinned, true);
  assert.equal(row.breaking, true);

  as(freelancer);
  await actions.saveArticle(art.id, {}, form({ slug: art.slug, aiBrug: "Ingen" })); // ingen afkrydsning fra forfatteren
  row = await db.article.findUniqueOrThrow({ where: { id: art.id } });
  assert.equal(row.pinned, true, "redaktørens fastgørelse overskrives ikke af forfatterens gem");
  assert.equal(row.breaking, true);

  // Ny artikel fra en forfatter: altid false.
  as(freelancer);
  await assert.rejects(() => actions.saveArticle(null, {}, form({ pinned: "on", breaking: "on" })), /NEXT_REDIRECT/);
  const fresh = await db.article.findFirstOrThrow({ where: { instansId, titel: "Testartikel om byrådet" }, orderBy: { createdAt: "desc" } });
  created.push(fresh.id);
  assert.deepEqual([fresh.pinned, fresh.breaking], [false, false]);
});

test("toggleArticleFlag kræver FRONTPAGE_EDIT og afviser ukendte felter", async () => {
  const art = await makeArticle();
  as(freelancer);
  await assert.rejects(() => actions.toggleArticleFlag(art.id, "pinned"), /Ingen adgang/);
  as(editor);
  await assert.rejects(() => actions.toggleArticleFlag(art.id, "status" as never), /Ukendt markering/);
  await actions.toggleArticleFlag(art.id, "pinned");
  assert.equal((await db.article.findUniqueOrThrow({ where: { id: art.id } })).pinned, true);
});

test("T6 nr. 8: AI-brug kræver et aktivt valg; 'Ingen AI brugt' er et gyldigt valg og kan publiceres", async () => {
  as(editor);
  const none = await makeArticle();
  let r = await actions.saveArticle(none.id, {}, form({ slug: none.slug, targetStatus: "Publiceret" }));
  assert.match(r.error ?? "", /AI-brug skal registreres/, "uden valg kan der ikke publiceres");
  r = await actions.saveArticle(none.id, {}, form({ slug: none.slug, targetStatus: "Publiceret", aiBrug: ["Ingen", "Udkast"] }));
  assert.match(r.error ?? "", /enten 'Ingen AI brugt' eller/);
  r = await actions.saveArticle(none.id, {}, form({ slug: none.slug, targetStatus: "Publiceret", aiBrug: "Opfundet brug" }));
  assert.match(r.error ?? "", /Ukendt AI-brug/);
  assert.equal((await db.article.findUniqueOrThrow({ where: { id: none.id } })).status, "Godkendelse");
  assert.equal(await db.knowledgePublicationOutbox.count({ where: { revision: { articleId: none.id } } }), 0,
    "afvist publicering opretter intet leveringssignal");

  r = await actions.saveArticle(none.id, {}, form({ slug: none.slug, targetStatus: "Publiceret", aiBrug: "Ingen" }));
  assert.equal(r.error, undefined, r.error);
  const row = await db.article.findUniqueOrThrow({ where: { id: none.id } });
  assert.equal(row.status, "Publiceret");
  assert.deepEqual(row.aiBrug, ["Ingen"]);
  const publishedRevision = await db.articleRevision.findFirstOrThrow({ where: { articleId: none.id, note: "Publiceret" } });
  const queued = await db.knowledgePublicationOutbox.findMany({ where: { articleRevisionId: publishedRevision.id } });
  assert.equal(queued.length, 1, "manuel publicering køer den konkrete uforanderlige revision");
  const update = await actions.saveArticle(none.id, {}, form({ slug: none.slug, titel: "Rettet testartikel om byrådet", aiBrug: "Ingen" }));
  assert.equal(update.error, undefined, update.error);
  const publishedRevisions = await db.articleRevision.findMany({ where: { articleId: none.id, note: "Publiceret" }, orderBy: { createdAt: "asc" } });
  assert.equal(publishedRevisions.length, 2);
  assert.equal(await db.knowledgePublicationOutbox.count({ where: { articleRevisionId: { in: publishedRevisions.map((rev) => rev.id) } } }), 2,
    "opdateret live artikel køer sin egen uforanderlige revision");

  // Kladdegem uden valg gemmer en TOM liste (ikke et stille "Ingen").
  const draft = await makeArticle({ status: "Idé" });
  as(freelancer);
  assert.equal((await actions.saveArticle(draft.id, {}, form({ slug: draft.slug }))).error, undefined);
  assert.deepEqual((await db.article.findUniqueOrThrow({ where: { id: draft.id } })).aiBrug, []);

  // AI-assisteret kan ikke registreres som "Ingen AI brugt".
  as(editor);
  const ai = await makeArticle();
  r = await actions.saveArticle(ai.id, {}, form({ slug: ai.slug, indholdstype: "AI-assisteret", aiBrug: "Ingen", markingKilder: "https://kilde.test/a" }));
  assert.match(r.error ?? "", /AI-assisteret indhold kan ikke registreres med 'Ingen AI brugt'|AI-assisteret/);
});

test("T5 P2-7: AI-spærringen følger kategoriens forældrekæde og gælder også Uafhængig med AI-udkast", async () => {
  as(editor);
  const art = await makeArticle({ status: "Idé" });
  // Uafhængig + udkast/omskrivning i barn af Krimi (uden 'krimi' i barnets navn/slug) -> spærret
  for (const use of ["Udkast", "Omskrivning"]) {
    const r = await actions.saveArticle(art.id, {}, form({ slug: art.slug, kategoriId: categoryKrimiChildId, aiBrug: use }));
    assert.match(r.error ?? "", /ikke tilladt i Krimi/, use);
  }
  // AI-assisteret i barnet -> spærret
  const r2 = await actions.saveArticle(art.id, {}, form({ slug: art.slug, kategoriId: categoryKrimiChildId, indholdstype: "AI-assisteret", aiBrug: "Sproglig korrektur", markingKilder: "https://kilde.test/a" }));
  assert.match(r2.error ?? "", /Krimi og retsvæsen samt Sundhed/);
  // Sproglig korrektur/ingen AI i Krimi er stadig tilladt for en menneskeskrevet artikel
  const ok = await actions.saveArticle(art.id, {}, form({ slug: art.slug, kategoriId: categoryKrimiChildId, aiBrug: "Sproglig korrektur" }));
  assert.equal(ok.error, undefined, ok.error);
  // Samme AI-brug i en almindelig kategori er tilladt
  const ok2 = await actions.saveArticle(art.id, {}, form({ slug: art.slug, kategoriId: categoryPolitikId, aiBrug: "Udkast" }));
  assert.equal(ok2.error, undefined, ok2.error);

  // Omdøbning af kategorien kan ikke omgå spærringen: selve kategorien 'krimi-og-retsvaesen' omdøbt, barnet er stadig spærret
  const krimi = await db.category.findFirstOrThrow({ where: { instansId, slug: "krimi-og-retsvaesen" } });
  await db.category.update({ where: { id: krimi.id }, data: { navn: "Retssager" } });
  const r3 = await actions.saveArticle(art.id, {}, form({ slug: art.slug, kategoriId: categoryKrimiChildId, aiBrug: "Udkast" }));
  assert.match(r3.error ?? "", /ikke tilladt i Krimi/, "stadig spærret (slug i forældrekæden)");
  await db.category.update({ where: { id: krimi.id }, data: { navn: "Krimi og retsvæsen" } });
});

test("T6 nr. 2: Partner kræver aftaleId ved publicering", async () => {
  as(editor);
  const art = await makeArticle();
  const base = { slug: art.slug, indholdstype: "Partner", targetStatus: "Publiceret", aiBrug: "Ingen", markingSponsor: "Eksempel Partner A", markingLabel: "Finansieret af Eksempel Partner A" };
  const missing = await actions.saveArticle(art.id, {}, form(base));
  assert.match(missing.error ?? "", /aftaleId/);
  assert.equal((await db.article.findUniqueOrThrow({ where: { id: art.id } })).status, "Godkendelse");
  const ok = await actions.saveArticle(art.id, {}, form({ ...base, markingAftaleId: "sa-eksempel" }));
  assert.equal(ok.error, undefined, ok.error);
  assert.equal((await db.article.findUniqueOrThrow({ where: { id: art.id } })).status, "Publiceret");
});

test("T6 nr. 15: 'godkendt af' er den publicerende bruger — fri tekst fra formularen ignoreres", async () => {
  as(editor);
  const art = await makeArticle();
  const r = await actions.saveArticle(art.id, {}, form({
    slug: art.slug, indholdstype: "AI-assisteret", targetStatus: "Publiceret", aiBrug: "Udkast",
    markingGodkendtAf: "Falsk Godkender", markingKilder: "https://kilde.test/a\nByrådssekretariatet",
  }));
  assert.equal(r.error, undefined, r.error);
  const marking = (await db.article.findUniqueOrThrow({ where: { id: art.id } })).marking as { godkendtAf: string; godkendtAfUserId: string; kilder: string[] };
  assert.equal(marking.godkendtAf, editor.navn);
  assert.equal(marking.godkendtAfUserId, editor.id);
  assert.notEqual(marking.godkendtAf, "Falsk Godkender");
  assert.equal(marking.kilder.length, 2);

  // Ved kladdegem sættes en godkender ikke fra formularen
  const draft = await makeArticle({ status: "Idé" });
  as(freelancer);
  await actions.saveArticle(draft.id, {}, form({ slug: draft.slug, indholdstype: "AI-assisteret", aiBrug: "Udkast", markingGodkendtAf: "Falsk Godkender", markingKilder: "https://kilde.test/a" }));
  assert.equal(((await db.article.findUniqueOrThrow({ where: { id: draft.id } })).marking as { godkendtAf: string }).godkendtAf, "");
});

test("T6 nr. 25: kladder med uverificeret kilde kan ikke publiceres før redaktøren har verificeret kilden", async () => {
  as(editor);
  const art = await makeArticle({ marking: { type: "Kilde-Q&A", kilde: "Anonym Kilde", uverificeretKilde: true } });
  const blocked = await actions.saveArticle(art.id, {}, form({ slug: art.slug, targetStatus: "Publiceret", aiBrug: "Ingen" }));
  assert.match(blocked.error ?? "", /ikke verificeret/);
  const stillFlag = (await db.article.findUniqueOrThrow({ where: { id: art.id } })).marking as { uverificeretKilde: boolean };
  assert.equal(stillFlag.uverificeretKilde, true, "flaget bevares (publicering afvist)");
  const ok = await actions.saveArticle(art.id, {}, form({ slug: art.slug, targetStatus: "Publiceret", aiBrug: "Ingen", kildeVerificeret: "on" }));
  assert.equal(ok.error, undefined, ok.error);
  assert.equal(((await db.article.findUniqueOrThrow({ where: { id: art.id } })).marking as { uverificeretKilde: boolean }).uverificeretKilde, false);
});

test("T6 nr. 9: statusskift gemmes som revision (hvem, fra/til)", async () => {
  as(freelancer);
  const art = await makeArticle({ status: "Idé" });
  const r = await actions.saveArticle(art.id, {}, form({ slug: art.slug, targetStatus: "Indsendt", aiBrug: "Ingen" }));
  assert.equal(r.error, undefined, r.error);
  const revs = await db.articleRevision.findMany({ where: { articleId: art.id } });
  assert.equal(await db.knowledgePublicationOutbox.count({ where: { articleRevisionId: { in: revs.map((rev) => rev.id) } } }), 0,
    "ikke-publicerede statusskift må ikke sendes til videnslaget");
  assert.equal(revs.length, 1);
  assert.equal(revs[0].userId, freelancer.id);
  assert.equal(revs[0].note, "Status: Idé → Indsendt");
  // Gem uden statusskift opretter ikke flere revisioner
  await actions.saveArticle(art.id, {}, form({ slug: art.slug, aiBrug: "Ingen" }));
  assert.equal(await db.articleRevision.count({ where: { articleId: art.id } }), 1);
});

test("T5 P2-5: rettelser kan ikke bagdateres og kan kun fjernes (soft delete) af en redaktør", async () => {
  const art = await makeArticle({ status: "Publiceret", publiceretTid: new Date() });
  as(freelancer);
  const fd = new FormData();
  fd.set("tekst", "Navnet på borgmesteren er rettet.");
  fd.set("dato", "2001-01-01T10:00"); // forsøg på bagdatering
  const add = await actions.addArticleCorrection(art.id, {}, fd);
  assert.match(add.success ?? "", /tilføjet/);
  const corr = await db.correction.findFirstOrThrow({ where: { articleId: art.id } });
  assert.ok(Date.now() - corr.dato.getTime() < 60_000, "dato er tidspunktet for oprettelsen");
  assert.equal(corr.oprettetAf, freelancer.id);

  assert.match((await actions.deleteArticleCorrection(corr.id, art.id)).error ?? "", /Kun en redaktør/);
  assert.equal((await db.correction.findUniqueOrThrow({ where: { id: corr.id } })).fjernetTid, null);

  // En fremmed forfatter kan heller ikke tilføje rettelse til andres artikel
  const other = await createUser(instansId, "Freelancejournalist");
  as(other);
  assert.match((await actions.addArticleCorrection(art.id, {}, fd)).error ?? "", /rettigheder til at redigere/);

  as(editor);
  assert.match((await actions.deleteArticleCorrection(corr.id, art.id)).success ?? "", /fjernet/);
  const gone = await db.correction.findUniqueOrThrow({ where: { id: corr.id } });
  assert.ok(gone.fjernetTid, "rækken findes stadig (revisionsspor)");
  assert.equal(gone.fjernetAf, editor.id);
  assert.match((await actions.deleteArticleCorrection(corr.id, art.id)).error ?? "", /findes ikke/, "allerede fjernet");

  // Redaktionsleder (editAll uden publicering) må også fjerne
  as(freelancer);
  fd.set("tekst", "Endnu en rettelse til artiklen.");
  await actions.addArticleCorrection(art.id, {}, fd);
  const c2 = await db.correction.findFirstOrThrow({ where: { articleId: art.id, fjernetTid: null } });
  as(leader);
  assert.match((await actions.deleteArticleCorrection(c2.id, art.id)).success ?? "", /fjernet/);
});

test("T5 P2-3: actions slår rettigheder op i databasen — nedgraderet og slettet bruger afvises trods gyldig JWT", async () => {
  const author2 = await db.author.create({ data: { navn: "Anders Anden", instansId } });
  const art = await makeArticle({ status: "Idé", forfatterId: author2.id });
  const user = await createUser(instansId, "Freelancejournalist", { authorId: author2.id });
  as(user);
  session.staleJwtPermissions = ["article.create", "article.publish", "article.editAll", "frontpage.edit"];
  assert.equal((await actions.saveArticle(art.id, {}, form({ slug: art.slug, aiBrug: "Ingen", forfatterId: author2.id }))).error, undefined, "før nedgradering");

  const producer = await db.role.findUniqueOrThrow({ where: { navn: "Medieproducent" } });
  await db.user.update({ where: { id: user.id }, data: { roleId: producer.id } });
  assert.match((await actions.saveArticle(art.id, {}, form({ slug: art.slug, aiBrug: "Ingen" }))).error ?? "", /ikke adgang/, "efter nedgradering");
  assert.match((await actions.addArticleCorrection(art.id, {}, new FormData())).error ?? "", /ikke adgang/);
  await assert.rejects(() => actions.toggleArticleFlag(art.id, "pinned"), /Ingen adgang/);

  await db.user.delete({ where: { id: user.id } });
  assert.match((await actions.saveArticle(art.id, {}, form({ slug: art.slug, aiBrug: "Ingen" }))).error ?? "", /ikke adgang/, "efter sletning");
  session.staleJwtPermissions = [];
});

test("T5 P3-1: pinArticleToZoneAction validerer zone, varighed, status og kvoteloft (PR tæller)", async () => {
  as(editor);
  const published = await makeArticle({ status: "Publiceret", publiceretTid: new Date(Date.now() - 3600_000) });
  const draft = await makeArticle({ status: "Idé" });
  const pin = (fields: Record<string, string>) => {
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) fd.set(k, v);
    return forside.pinArticleToZoneAction(fd);
  };
  await assert.rejects(() => pin({ articleId: published.id, zone: "findes-ikke" }), /Ugyldig zone/);
  await assert.rejects(() => pin({ articleId: published.id, zone: "top-hoved", durationHours: "0" }), /Varighed/);
  await assert.rejects(() => pin({ articleId: published.id, zone: "top-hoved", durationHours: "-5" }), /Varighed/);
  await assert.rejects(() => pin({ articleId: published.id, zone: "top-hoved", durationHours: "99999" }), /Varighed/);
  await assert.rejects(() => pin({ articleId: published.id, zone: "top-hoved", position: "-1" }), /Ugyldig position/);
  await assert.rejects(() => pin({ articleId: draft.id, zone: "top-hoved" }), /publicerede/);
  await pin({ articleId: published.id, zone: "top-hoved", durationHours: "24" });
  const placement = await db.frontpagePlacement.findFirstOrThrow({ where: { instansId, articleId: published.id } });
  assert.ok(placement.udloebTid && placement.udloebTid.getTime() > Date.now(), "en pin har altid udløb");

  // Kvoteloft 0 % -> loftet er nået; PR (som tæller som kommerciel) må ikke fastgøres, Uafhængig må.
  await db.instance.update({ where: { id: instansId }, data: { kvoteloftProcent: 0 } });
  const pr = await makeArticle({ status: "Publiceret", publiceretTid: new Date(Date.now() - 3600_000), indholdstype: "PR", marking: { afsender: "Eksempel Afsender" } });
  await assert.rejects(() => pin({ articleId: pr.id, zone: "top-sekundaer" }), /Kvoteloft overskredet/);
  const nonCommercial = await makeArticle({ status: "Publiceret", publiceretTid: new Date(Date.now() - 3600_000) });
  await pin({ articleId: nonCommercial.id, zone: "top-sekundaer" });
  await db.instance.update({ where: { id: instansId }, data: { kvoteloftProcent: 25 } });
});
