import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import { db } from "../lib/db";
import { DEFAULT_ROLES } from "../lib/default-roles";
import { HIDDEN_CONTACT, PAGE_PERMISSIONS, canAccessPage, type RedaktionPage } from "../lib/redaktion-access";
import { PERMISSIONS } from "../lib/permissions";
import { createInstance, createUser, findElement, installNextMocks, session, uniq } from "./helpers/mock-session";

installNextMocks();

type PageModule = { default: () => Promise<unknown> };
const pages: Record<RedaktionPage, () => Promise<PageModule>> = {
  engine: () => import("../app/redaktion/engine/page"),
  kontrolrum: () => import("../app/redaktion/kontrolrum/page"),
  indbakke: () => import("../app/redaktion/indbakke/page"),
  qa: () => import("../app/redaktion/qa/page"),
  interview: () => import("../app/redaktion/interview/page"),
  meddeler: () => import("../app/redaktion/meddeler/page"),
  nyhedsbrev: () => import("../app/redaktion/nyhedsbrev/page"),
  sponsor: () => import("../app/redaktion/sponsor/page"),
  annoncer: () => import("../app/redaktion/annoncer/page"),
  metrikker: () => import("../app/redaktion/metrikker/page"),
  omraader: () => import("../app/redaktion/omraader/page"),
};

/** Forventet adgang pr. standardrolle (T5 P1-2). */
const EXPECTED: Record<string, RedaktionPage[]> = {
  "Ansvarshavende redaktør": ["engine", "kontrolrum", "indbakke", "qa", "interview", "meddeler", "nyhedsbrev", "sponsor", "annoncer", "metrikker", "omraader"],
  Redaktionsleder: ["engine", "indbakke", "qa", "interview", "meddeler", "nyhedsbrev", "sponsor", "annoncer", "metrikker", "omraader"],
  Freelancejournalist: ["engine", "indbakke", "qa", "interview", "meddeler"],
  Medieproducent: [],
  "Community manager": ["engine", "indbakke", "qa", "interview", "meddeler", "nyhedsbrev"],
  "Salgs- og partnerskabsansvarlig": ["sponsor", "annoncer"],
  "Teknisk produktansvarlig": ["kontrolrum"],
  Støtte: ["sponsor", "annoncer"],
};

let instansId = "";
const users: Record<string, string> = {};
let NoAccess: unknown;

before(async () => {
  const inst = await createInstance("Acc");
  instansId = inst.id;
  for (const def of DEFAULT_ROLES) users[def.navn] = (await createUser(instansId, def.navn)).id;
  NoAccess = (await import("../components/admin/no-access")).NoAccess;

  const meddeler = await db.meddelerProfile.create({ data: { instansId, navn: "Meddeler Mette", kontakt: "mette@kilde.test", phone: "11223344", telefon: "55667788", token: uniq("mtok"), noter: "intern note" } });
  await db.meddelerSag.create({ data: { instansId, meddelerId: meddeler.id, titel: "Sag", tekst: "Tekst" } });
  await db.sourceQA.create({ data: { instansId, titel: "QA", emne: "Emne", kildeNavn: "Kilde Karl", kildeKontakt: "karl@kilde.test", token: uniq("qtok"), spoergsmaal: [] } });
  await db.interviewSession.create({ data: { instansId, emne: "Emne", kildeNavn: "Kilde Kim", kildeKontakt: "kim@kilde.test", token: uniq("itok"), spoergsmaal: [] } });
  await db.sponsorBrief.create({ data: { instansId, partnerNavn: "Eksempel Partner", kontaktNavn: "Pia", kontaktEmail: "pia@partner.test", token: uniq("ptok") } });
  await db.submission.create({ data: { instansId, navn: "Borger Bo", kontakt: "bo@borger.test", emne: "Tip", tekst: "Et tip" } });
  await db.newsletterSubscriber.create({ data: { instansId, email: "abonnent@test.local" } });
  await db.adCampaign.create({ data: { instansId, titel: "Kampagne", annoncoer: "Eksempel Partner", format: "IN_FEED_BANNER", startDato: new Date(), slutDato: new Date(Date.now() + 86_400_000), kreativData: {} } });
});

after(async () => {
  await db.meddelerSag.deleteMany({ where: { instansId } });
  await db.meddelerProfile.deleteMany({ where: { instansId } });
  await db.sourceQA.deleteMany({ where: { instansId } });
  await db.interviewSession.deleteMany({ where: { instansId } });
  await db.sponsorBrief.deleteMany({ where: { instansId } });
  await db.submission.deleteMany({ where: { instansId } });
  await db.newsletterSubscriber.deleteMany({ where: { instansId } });
  await db.adCampaign.deleteMany({ where: { instansId } });
  await db.user.deleteMany({ where: { instansId } });
  await db.instance.delete({ where: { id: instansId } });
});

test("rettighedskortet (canAccessPage) følger standardrollerne", () => {
  for (const def of DEFAULT_ROLES) {
    const user = { permissions: [...def.permissions] };
    const allowed = (Object.keys(PAGE_PERMISSIONS) as RedaktionPage[]).filter((p) => canAccessPage(user, p)).sort();
    assert.deepEqual(allowed, [...(EXPECTED[def.navn] ?? [])].sort(), def.navn);
  }
  assert.ok(!canAccessPage(null, "indbakke"));
  assert.ok(!canAccessPage({ permissions: [] }, "nyhedsbrev"));
});

test("hver redaktionsside slår rettigheden op server-side: ingen adgang uden den, data kun med den", async () => {
  for (const [role, allowedPages] of Object.entries(EXPECTED)) {
    session.userId = users[role];
    for (const [name, load] of Object.entries(pages) as Array<[RedaktionPage, () => Promise<PageModule>]>) {
      const mod = await load();
      const result = (await mod.default()) as { type?: unknown } | null;
      const denied = Boolean(result && result.type === NoAccess);
      assert.equal(denied, !allowedPages.includes(name), `${role} -> /redaktion/${name}: ${denied ? "afvist" : "adgang"}`);
    }
  }
});

test("uden login, slettet bruger og forældet JWT giver ingen adgang (rettigheder læses fra databasen)", async () => {
  const mod = await pages.indbakke();
  session.userId = null;
  assert.equal(((await mod.default()) as { type?: unknown }).type, NoAccess, "ingen session");

  // Slettet bruger: JWT'en er stadig gyldig, men brugeren findes ikke længere.
  const gone = await createUser(instansId, "Freelancejournalist");
  session.userId = gone.id;
  assert.notEqual(((await mod.default()) as { type?: unknown }).type, NoAccess, "før sletning: adgang");
  await db.user.delete({ where: { id: gone.id } });
  assert.equal(((await mod.default()) as { type?: unknown }).type, NoAccess, "efter sletning: afvist");

  // Nedgraderet rolle: JWT hævder stadig article.create, men databasen siger Medieproducent.
  const demoted = await createUser(instansId, "Medieproducent");
  session.userId = demoted.id;
  session.staleJwtPermissions = [PERMISSIONS.ARTICLE_CREATE, PERMISSIONS.NEWSLETTER_MANAGE, PERMISSIONS.SOURCE_VIEW_CONFIDENTIAL];
  for (const name of ["indbakke", "qa", "nyhedsbrev"] as const) {
    assert.equal(((await (await pages[name]()).default()) as { type?: unknown }).type, NoAccess, `forældet JWT må ikke give adgang til ${name}`);
  }
  session.staleJwtPermissions = [];
});

test("kildekontakter og portal-links kræver source.viewConfidential (Community manager ser dem ikke)", async () => {
  const { UnifiedIntakeInbox } = await import("../components/admin/UnifiedIntakeInbox");
  const { QaListClient } = await import("../app/redaktion/qa/QaListClient");
  const { InterviewListClient } = await import("../app/redaktion/interview/InterviewListClient");
  const { MeddelerListClient } = await import("../app/redaktion/meddeler/MeddelerListClient");

  for (const [role, mayView] of [["Community manager", false], ["Freelancejournalist", true], ["Redaktionsleder", true]] as const) {
    session.userId = users[role];
    const inbox = findElement(await (await pages.indbakke()).default(), UnifiedIntakeInbox);
    assert.ok(inbox, `${role}: indbakken vises`);
    const items = inbox.props.items as Array<{ channel: string; senderContact?: string | null; token?: string }>;
    assert.ok(items.length >= 4, `${role}: kilder vises`);
    for (const it of items.filter((i) => i.channel !== "sponsor")) {
      if (mayView) assert.ok(it.senderContact && it.senderContact !== HIDDEN_CONTACT, `${role}/${it.channel}: kontakt synlig`);
      else {
        assert.equal(it.senderContact, HIDDEN_CONTACT, `${role}/${it.channel}: kontakt skjult`);
        assert.equal(it.token, undefined, `${role}/${it.channel}: portal-link skjult`);
      }
    }
    // Partnerbriefs (kontakt hos partner) kræver salgs-/supportrettighed: kun Redaktionsleder (SUPPORT_READ) har dem.
    assert.equal(items.some((i) => i.channel === "sponsor"), role === "Redaktionsleder", `${role}: partnerbriefs`);

    const payload = (el: { props: Record<string, unknown> } | null) => JSON.stringify(el?.props ?? {});
    const qa = findElement(await (await pages.qa()).default(), QaListClient);
    const iv = findElement(await (await pages.interview()).default(), InterviewListClient);
    const md = findElement(await (await pages.meddeler()).default(), MeddelerListClient);
    for (const [label, el, secrets] of [["qa", qa, ["karl@kilde.test"]], ["interview", iv, ["kim@kilde.test"]], ["meddeler", md, ["mette@kilde.test", "11223344", "55667788", "intern note"]]] as const) {
      assert.ok(el, `${role}/${label}: side vises`);
      for (const secret of secrets) {
        assert.equal(payload(el).includes(secret), mayView, `${role}/${label}: '${secret}' ${mayView ? "kan" : "må ikke"} ligge i data til klienten`);
      }
      if (!mayView) assert.ok(!/"token":"[^"]+"/.test(payload(el)), `${role}/${label}: ingen portal-token i klientdata`);
    }
  }
});

test("annoncer: SUPPORT_READ giver kun visning (ingen ændringsformularer); ADS_MANAGE giver fuld adgang", async () => {
  const { AdGeneratorForm } = await import("../components/admin/AdGeneratorForm");
  session.userId = users["Støtte"];
  assert.equal(findElement(await (await pages.annoncer()).default(), AdGeneratorForm), null, "Støtte kan ikke oprette kampagner");
  session.userId = users["Salgs- og partnerskabsansvarlig"];
  assert.ok(findElement(await (await pages.annoncer()).default(), AdGeneratorForm), "Salg kan oprette kampagner");
});

test("konvertering af partnerbriefs kræver samme adgang som visningen (per handling, DB-opslag)", async () => {
  const { convertSponsorBriefToArticle } = await import("../app/redaktion/indbakke/actions");
  const brief = await db.sponsorBrief.findFirstOrThrow({ where: { instansId } });
  session.userId = users["Freelancejournalist"];
  assert.match(String((await convertSponsorBriefToArticle(brief.id)).error), /ikke adgang til partnerbriefs/);
  assert.equal(await db.article.count({ where: { instansId } }), 0);
  session.userId = users["Salgs- og partnerskabsansvarlig"];
  assert.match(String((await convertSponsorBriefToArticle(brief.id)).error), /rettigheder til at oprette artikler/, "salg kan ikke oprette artikler");
  session.userId = users["Redaktionsleder"];
  assert.equal((await convertSponsorBriefToArticle(brief.id)).success, true);
  const art = await db.article.findFirstOrThrow({ where: { instansId } });
  assert.equal(art.indholdstype, "Partner");
  assert.equal(art.status, "Idé", "konvertering publicerer aldrig");
  await db.sponsorBrief.update({ where: { id: brief.id }, data: { articleId: null, status: "Booket" } });
  await db.article.deleteMany({ where: { instansId } });
});
