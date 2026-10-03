import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import { db } from "../lib/db";
import { createInstance, installNextMocks, uniq } from "./helpers/mock-session";

installNextMocks();

type Sched = typeof import("../lib/scheduled-publish");
type Route = typeof import("../app/api/cron/publish-scheduled/route");
let sched: Sched;
let route: Route;
let instansId = "";
let otherId = "";
let catId = "";
const SECRET = "test-cron-secret-1234567890";
const BLOCKS = [{ id: "b1", type: "paragraph", data: { content: "<p>Tekst</p>" } }];
const past = () => new Date(Date.now() - 60_000);
const future = () => new Date(Date.now() + 3_600_000);

async function make(over: Record<string, unknown> = {}, inst = instansId) {
  return db.article.create({ data: { titel: "Planlagt", slug: uniq("sched"), blocks: BLOCKS, aiBrug: ["Ingen"], status: "Planlagt", planlagtTid: past(), instansId: inst, kategoriId: inst === instansId ? catId : null, ...over } });
}

before(async () => {
  sched = await import("../lib/scheduled-publish");
  route = await import("../app/api/cron/publish-scheduled/route");
  instansId = (await createInstance("Sched")).id;
  otherId = (await createInstance("SchedAndet")).id;
  catId = (await db.category.create({ data: { instansId, navn: "Nyheder", slug: "nyheder" } })).id;
});

after(async () => {
  for (const id of [instansId, otherId]) {
    await db.articleRevision.deleteMany({ where: { article: { instansId: id } } });
    await db.auditLog.deleteMany({ where: { instansId: id } });
    await db.article.deleteMany({ where: { instansId: id } });
    await db.category.deleteMany({ where: { instansId: id } });
    await db.instance.delete({ where: { id } });
  }
});

test("planlagt publicering: kun Planlagt og kun forfaldne; revision (scheduler), publiceretTid og audit; idempotent", async () => {
  const due = await make();
  const notYet = await make({ planlagtTid: future() });
  const draft = await make({ status: "Udkast" }); // forfalden tid, men ikke Planlagt
  const live = await make({ status: "Publiceret", publiceretTid: new Date("2026-01-01T00:00:00Z"), planlagtTid: past() });
  const archived = await make({ status: "Arkiveret" });
  const noTime = await make({ planlagtTid: null });

  const now = new Date();
  const res = await sched.publishDueArticles({ now, instansId });
  assert.deepEqual(res.published.map((p) => p.id), [due.id]);
  assert.equal(res.skipped.length, 0);

  const row = await db.article.findUniqueOrThrow({ where: { id: due.id } });
  assert.equal(row.status, "Publiceret");
  assert.ok(row.publiceretTid && row.publiceretTid.getTime() >= now.getTime() - 1000 && row.publiceretTid.getTime() <= Date.now() + 1000);
  const revs = await db.articleRevision.findMany({ where: { articleId: due.id } });
  assert.equal(revs.length, 1);
  assert.equal(revs[0].userId, null);
  assert.match(revs[0].note ?? "", /scheduler/);
  assert.equal((revs[0].snapshot as { _actor: string })._actor, "scheduler");
  assert.equal(await db.knowledgePublicationOutbox.count({ where: { articleRevisionId: revs[0].id } }), 1,
    "planlagt publicering køer præcis den publicerede revision");
  assert.equal((await db.auditLog.findFirstOrThrow({ where: { instansId, targetId: due.id } })).actorLabel, "scheduler");

  for (const [a, status] of [[notYet, "Planlagt"], [draft, "Udkast"], [archived, "Arkiveret"], [noTime, "Planlagt"]] as const) {
    assert.equal((await db.article.findUniqueOrThrow({ where: { id: a.id } })).status, status);
  }
  const liveRow = await db.article.findUniqueOrThrow({ where: { id: live.id } });
  assert.equal(liveRow.publiceretTid?.toISOString(), "2026-01-01T00:00:00.000Z", "allerede publiceret røres ikke");

  // idempotent: anden kørsel gør intet og skriver ingen ny revision
  const again = await sched.publishDueArticles({ now: new Date(), instansId });
  assert.equal(again.published.length, 0);
  assert.equal(await db.articleRevision.count({ where: { articleId: due.id } }), 1);
  assert.equal(await db.knowledgePublicationOutbox.count({ where: { articleRevisionId: revs[0].id } }), 1);
});

test("planlagt publicering: håndhæver publiceringskrav (mærkning, AI-brug, kildeverifikation) — springer over i stedet for at publicere", async () => {
  const noAi = await make({ aiBrug: [] });
  const partner = await make({ indholdstype: "Partner", marking: { sponsor: "A" } });
  const unverified = await make({ marking: { type: "Q&A", uverificeretKilde: true } });
  const good = await make({ indholdstype: "Sponsoreret", marking: { sponsor: "Bank", labelTekst: "ANNONCE" } });
  const res = await sched.publishDueArticles({ instansId });
  assert.deepEqual(res.published.map((p) => p.id), [good.id]);
  assert.equal(res.skipped.length, 3);
  assert.match(res.skipped.find((s) => s.id === noAi.id)!.reason, /AI-brug/);
  assert.match(res.skipped.find((s) => s.id === partner.id)!.reason, /Partner/);
  assert.match(res.skipped.find((s) => s.id === unverified.id)!.reason, /verificeret/);
  for (const a of [noAi, partner, unverified]) assert.equal((await db.article.findUniqueOrThrow({ where: { id: a.id } })).status, "Planlagt");
});

test("planlagt publicering: små batches (ældste først), tenant-afgrænsning og betinget opdatering mod samtidige kørsler", async () => {
  for (const art of await db.article.findMany({ where: { instansId, status: "Planlagt" } })) await db.article.update({ where: { id: art.id }, data: { status: "Arkiveret" } });
  const a1 = await make({ planlagtTid: new Date(Date.now() - 3 * 60_000) });
  const a2 = await make({ planlagtTid: new Date(Date.now() - 2 * 60_000) });
  const a3 = await make({ planlagtTid: new Date(Date.now() - 60_000) });
  const foreign = await make({}, otherId);
  const first = await sched.publishDueArticles({ instansId, batchSize: 2 });
  assert.deepEqual(first.published.map((p) => p.id), [a1.id, a2.id], "ældste først, højst batchSize");
  assert.equal((await db.article.findUniqueOrThrow({ where: { id: foreign.id } })).status, "Planlagt", "andre instanser røres ikke når instans angives");
  // to samtidige kørsler publicerer a3 præcis én gang
  const [x, y] = await Promise.all([sched.publishDueArticles({ instansId }), sched.publishDueArticles({ instansId })]);
  assert.equal(x.published.length + y.published.length, 1);
  assert.equal(await db.articleRevision.count({ where: { articleId: a3.id } }), 1);
  const raceRevision = await db.articleRevision.findFirstOrThrow({ where: { articleId: a3.id } });
  assert.equal(await db.knowledgePublicationOutbox.count({ where: { articleRevisionId: raceRevision.id } }), 1);
  // uden instans-afgrænsning (som cron) publiceres alle instansers forfaldne
  const all = await sched.publishDueArticles({});
  assert.ok(all.published.some((p) => p.id === foreign.id));
  assert.equal((await db.article.findUniqueOrThrow({ where: { id: foreign.id } })).status, "Publiceret");
  assert.equal(sched.MAX_BATCH >= sched.DEFAULT_BATCH, true);
});

function req(headers: Record<string, string> = {}, query = "") {
  return new Request(`http://localhost/api/cron/publish-scheduled${query}`, { method: "POST", headers });
}

test("cron-rute: 503 uden CRON_SECRET, 401 uden/forkert Bearer, 200 med korrekt; rører kun Planlagt og forfaldne", async () => {
  delete process.env.CRON_SECRET;
  assert.equal((await route.POST(req())).status, 503);
  process.env.CRON_SECRET = "kort";
  assert.equal((await route.POST(req({ authorization: "Bearer kort" }))).status, 503, "for kort hemmelighed er aldrig åben");
  process.env.CRON_SECRET = SECRET;
  assert.equal((await route.POST(req())).status, 401);
  const wrong = await route.POST(req({ authorization: "Bearer forkert-forkert-forkert" }));
  assert.equal(wrong.status, 401);
  assert.match(wrong.headers.get("www-authenticate") ?? "", /Bearer/);
  assert.equal((await route.GET(req({ authorization: `Basic ${SECRET}` }))).status, 401);

  const due = await make();
  const draft = await make({ status: "Udkast" });
  const ok = await route.POST(req({ authorization: `Bearer ${SECRET}` }, `?instans=${instansId}`));
  assert.equal(ok.status, 200);
  const body = (await ok.json()) as { ok: boolean; published: { id: string }[]; checked: number };
  assert.equal(body.ok, true);
  assert.deepEqual(body.published.map((p) => p.id), [due.id]);
  assert.equal((await db.article.findUniqueOrThrow({ where: { id: draft.id } })).status, "Udkast");
  assert.equal(ok.headers.get("cache-control"), "no-store");
  // idempotent
  const second = (await (await route.POST(req({ authorization: `Bearer ${SECRET}` }, `?instans=${instansId}`))).json()) as { published: unknown[] };
  assert.equal(second.published.length, 0);
  delete process.env.CRON_SECRET;
});
