import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import { db } from "../lib/db";
import { createApiKey } from "../lib/ingest/auth";
import { rateSource } from "../lib/engine/source-rating";
import { FEED_TYPES, parseFeedInput, parseKeywords } from "../lib/feeds/input";
import { parseSourceProfileInput } from "../lib/sources/input";
import { MemoryRateLimitStore, setRateLimitStore } from "../lib/ratelimit";
import { createInstance, createUser, installNextMocks, session } from "./helpers/mock-session";

installNextMocks();

type Sources = typeof import("../lib/sources/store");
type Feeds = typeof import("../lib/feeds/store");
type FeedRoute = typeof import("../app/api/ingest/feeds/route");
let sources: Sources;
let feeds: Feeds;
let route: FeedRoute;
let instansId = "";
let otherId = "";
let editor: Awaited<ReturnType<typeof createUser>>;
let leader: Awaited<ReturnType<typeof createUser>>;
let otherEditor: Awaited<ReturnType<typeof createUser>>;
let keyA = "";
let keyB = "";
let readOnlyKey = "";

before(async () => {
  setRateLimitStore(new MemoryRateLimitStore());
  sources = await import("../lib/sources/store");
  feeds = await import("../lib/feeds/store");
  route = await import("../app/api/ingest/feeds/route");
  instansId = (await createInstance("Kr")).id;
  otherId = (await createInstance("KrAndet")).id;
  editor = await createUser(instansId, "Ansvarshavende redaktør");
  leader = await createUser(instansId, "Redaktionsleder");
  otherEditor = await createUser(otherId, "Ansvarshavende redaktør");
  keyA = (await createApiKey({ instansId, name: "Agent A", scopes: ["signals:write"] })).key;
  keyB = (await createApiKey({ instansId: otherId, name: "Agent B", scopes: ["signals:write"] })).key;
  readOnlyKey = (await createApiKey({ instansId, name: "Kun helbred", scopes: ["health:read"] })).key;
});

after(async () => {
  for (const id of [instansId, otherId]) {
    await db.auditLog.deleteMany({ where: { instansId: id } });
    await db.apiKey.deleteMany({ where: { instansId: id } });
    await db.sourceProfile.deleteMany({ where: { instansId: id } });
    await db.feedDefinition.deleteMany({ where: { instansId: id } });
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

const get = (key: string | null) => route.GET(new Request("http://test.local/api/ingest/feeds", { headers: { ...(key ? { authorization: `Bearer ${key}` } : {}), "x-forwarded-for": "198.51.100.9" } }));

// ── Validering (rent) ────────────────────────────────────────────────────────

test("kilde-input: navn, type, domæne og score valideres, og domænet normaliseres", () => {
  const ok = parseSourceProfileInput({ navn: "  Havneforeningen ", type: "forening", domaene: "https://www.Havneforening.dk/nyt", score: "70", note: "Kendt" });
  assert.deepEqual(ok, { ok: true, value: { navn: "Havneforeningen", type: "forening", domaene: "havneforening.dk", score: 70, note: "Kendt", aktiv: true } });
  assert.equal(parseSourceProfileInput({ navn: "A", type: "forening", score: 50 }).ok, false);
  assert.equal(parseSourceProfileInput({ navn: "Ok navn", type: "findes-ikke", score: 50 }).ok, false);
  assert.equal(parseSourceProfileInput({ navn: "Ok navn", type: "andet", score: 101 }).ok, false);
  assert.equal(parseSourceProfileInput({ navn: "Ok navn", type: "andet", score: 50.5 }).ok, false);
  assert.equal(parseSourceProfileInput({ navn: "Ok navn", type: "andet", score: "" }).ok, false);
  assert.equal(parseSourceProfileInput({ navn: "Ok navn", type: "andet", score: 50, domaene: "ikke et domæne" }).ok, false);
  assert.equal(parseSourceProfileInput({ navn: "Ok navn", type: "andet", score: 50, domaene: "javascript:alert(1)" }).ok, false);
  const noDomain = parseSourceProfileInput({ navn: "Ritzau", type: "nyhedsbureau", score: 75, aktiv: false });
  assert.equal(noDomain.ok && noDomain.value.domaene, null);
  assert.equal(noDomain.ok && noDomain.value.aktiv, false);
  const stripped = parseSourceProfileInput({ navn: "<b>Fed</b> kilde", type: "andet", score: 40, note: "<script>x</script>Pæn note" });
  assert.equal(stripped.ok && stripped.value.navn, "Fed kilde");
  assert.ok(stripped.ok && !stripped.value.note?.includes("<"));
});

test("feed-input: type, URL, nøgleord og interval valideres", () => {
  const ok = parseFeedInput({ navn: "Politiets døgnrapport", type: "rss", url: "https://politi.dk/rss", sourceType: "politi", inkluder: "Næstved, Slagelse\nnæstved", ekskluder: "trafik", intervalMin: "15", omraadeTekst: "Sydsjælland" });
  assert.equal(ok.ok, true);
  if (ok.ok) {
    assert.deepEqual(ok.value.inkluder, ["Næstved", "Slagelse"], "dubletter fjernes uden hensyn til store/små bogstaver");
    assert.equal(ok.value.intervalMin, 15);
    assert.equal(ok.value.sourceType, "politi");
  }
  assert.equal(parseFeedInput({ navn: "Feed", type: "rss" }).ok, false, "RSS kræver URL");
  assert.equal(parseFeedInput({ navn: "Feed", type: "mail" }).ok, true, "mail kræver ikke URL");
  assert.equal(parseFeedInput({ navn: "Feed", type: "rss", url: "ftp://x.dk/feed" }).ok, false);
  assert.equal(parseFeedInput({ navn: "Feed", type: "rss", url: "javascript:alert(1)" }).ok, false);
  assert.equal(parseFeedInput({ navn: "Feed", type: "ukendt", url: "https://x.dk" }).ok, false);
  assert.equal(parseFeedInput({ navn: "Feed", type: "rss", url: "https://x.dk", sourceType: "ukendt" }).ok, false);
  assert.equal(parseFeedInput({ navn: "Feed", type: "rss", url: "https://x.dk", intervalMin: 1 }).ok, false);
  assert.equal(parseFeedInput({ navn: "Feed", type: "rss", url: "https://x.dk", intervalMin: 5000 }).ok, false);
  assert.equal(parseKeywords(Array.from({ length: 21 }, (_, i) => `ord${i}`).join(",")).ok, false);
  assert.equal(parseKeywords("a").ok, false);
  assert.deepEqual(FEED_TYPES, ["rss", "api", "web", "mail"]);
});

// ── Kilderegister ────────────────────────────────────────────────────────────

test("kilderegister: oprettelse kræver controlroom.manage og er afgrænset til instansen; ratingen bruger det", async () => {
  const denied = await sources.createSourceProfile(await authorized(leader), { navn: "Lokalavisen", type: "lokalt_medie", score: 55 });
  assert.equal(denied.ok, false);
  assert.equal(await db.sourceProfile.count({ where: { instansId } }), 0);

  const user = await authorized(editor);
  const created = await sources.createSourceProfile(user, { navn: "Havneforeningen", type: "forening", domaene: "havneforening.dk", score: 82, note: "Kendt og pålidelig" });
  assert.equal(created.ok, true);
  const dup = await sources.createSourceProfile(user, { navn: "Havneforeningen", type: "forening", score: 10 });
  assert.deepEqual(dup, { ok: false, error: "Der findes allerede en kilde med det navn." });

  const profiles = await sources.loadActiveSourceProfiles(instansId);
  assert.equal(rateSource({ url: "https://www.havneforening.dk/nyt", sourceType: "forening" }, profiles).grade, "A");
  assert.deepEqual(await sources.loadActiveSourceProfiles(otherId), [], "den anden instans ser ikke kilden");

  const row = (await sources.listSourceProfiles(instansId))[0];
  assert.equal((await sources.updateSourceProfile(user, row.id, { navn: "Havneforeningen", type: "forening", domaene: "havneforening.dk", score: 30, aktiv: false })).ok, true);
  assert.deepEqual(await sources.loadActiveSourceProfiles(instansId), [], "inaktive kilder bruges ikke");

  // En anden instans' redaktør kan hverken ændre eller slette posten
  const other = await authorized(otherEditor);
  assert.deepEqual(await sources.updateSourceProfile(other, row.id, { navn: "Kapret", type: "andet", score: 100 }), { ok: false, error: "Kilden findes ikke." });
  assert.deepEqual(await sources.deleteSourceProfile(other, row.id), { ok: false, error: "Kilden findes ikke." });
  assert.equal((await db.sourceProfile.findUniqueOrThrow({ where: { id: row.id } })).navn, "Havneforeningen");

  assert.equal((await sources.deleteSourceProfile(user, row.id)).ok, true);
});

test("import af standardkilder er idempotent og rører ikke eksisterende poster", async () => {
  const user = await authorized(editor);
  await sources.createSourceProfile(user, { navn: "Politiet", type: "politi", domaene: "politi.dk", score: 61, note: "Mit eget skøn" });
  const first = await sources.importDefaultSourceProfiles(user);
  assert.equal(first.ok, true);
  const second = await sources.importDefaultSourceProfiles(user);
  assert.deepEqual(second, { ok: true, besked: "Alle standardkilder findes allerede." });
  const politi = await db.sourceProfile.findFirstOrThrow({ where: { instansId, navn: "Politiet" } });
  assert.equal(politi.score, 61, "eksisterende post er uændret");
  assert.ok((await db.sourceProfile.count({ where: { instansId } })) > 10);
  assert.equal(await db.sourceProfile.count({ where: { instansId: otherId } }), 0);
});

// ── Feeds ────────────────────────────────────────────────────────────────────

test("feeds: oprettelse kræver controlroom.manage; dubletnavn afvises; instanser holdes adskilt", async () => {
  assert.equal((await feeds.createFeed(await authorized(leader), { navn: "Politi", type: "rss", url: "https://politi.dk/rss" })).ok, false);
  const user = await authorized(editor);
  assert.equal((await feeds.createFeed(user, { navn: "Politiets døgnrapport", type: "rss", url: "https://politi.dk/rss", sourceType: "politi", inkluder: "Næstved", intervalMin: 15 })).ok, true);
  assert.equal((await feeds.createFeed(user, { navn: "Kommunens dagsordener", type: "web", url: "https://naestved.dk/dagsorden", sourceType: "kommune_dagsorden" })).ok, true);
  assert.equal((await feeds.createFeed(user, { navn: "Slukket feed", type: "rss", url: "https://x.dk/rss", aktiv: false })).ok, true);
  assert.deepEqual(await feeds.createFeed(user, { navn: "Politiets døgnrapport", type: "rss", url: "https://politi.dk/rss" }), { ok: false, error: "Der findes allerede et feed med det navn." });
  assert.equal((await feeds.listFeeds(instansId)).length, 3);
  assert.equal((await feeds.listFeeds(otherId)).length, 0);

  const target = (await feeds.listFeeds(instansId)).find((f) => f.navn === "Slukket feed")!;
  const other = await authorized(otherEditor);
  assert.deepEqual(await feeds.deleteFeed(other, target.id), { ok: false, error: "Feedet findes ikke." });
  assert.equal((await feeds.updateFeed(other, target.id, { navn: "Kapret", type: "rss", url: "https://x.dk/rss" })).ok, false);
  assert.equal(await db.feedDefinition.count({ where: { id: target.id } }), 1);
});

test("GET /api/ingest/feeds: kræver nøgle med signals:write, leverer kun AKTIVE feeds for nøglens egen instans", async () => {
  assert.equal((await get(null)).status, 401);
  assert.equal((await get("lk_ikke-en-rigtig-noegle-1234567890123456789")).status, 401); // secret-scan:ignore (bevidst falsk nøgle)
  assert.equal((await get(readOnlyKey)).status, 403, "scope signals:write kræves");

  const res = await get(keyA);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("cache-control"), "no-store");
  const body = (await res.json()) as { feeds: Array<{ navn: string; inkluder: string[]; intervalMin: number; url: string | null }> };
  assert.deepEqual(body.feeds.map((f) => f.navn).sort(), ["Kommunens dagsordener", "Politiets døgnrapport"], "det slukkede feed leveres ikke");
  const politi = body.feeds.find((f) => f.navn === "Politiets døgnrapport")!;
  assert.deepEqual(politi.inkluder, ["Næstved"]);
  assert.equal(politi.intervalMin, 15);
  assert.ok(!JSON.stringify(body).includes("instansId"), "ingen interne id'er om instansen");

  const other = (await (await get(keyB)).json()) as { feeds: unknown[] };
  assert.deepEqual(other.feeds, [], "den anden instans' nøgle ser ingen af disse feeds");
});

test("auditloggen for kontrolrummet har aldrig URL'er eller noter", async () => {
  const logs = await db.auditLog.findMany({ where: { instansId, action: { in: ["source.create", "source.update", "feed.create", "source.import"] } } });
  assert.ok(logs.length >= 4);
  const blob = JSON.stringify(logs);
  assert.ok(!blob.includes("politi.dk/rss") && !blob.includes("Mit eget skøn") && !blob.includes("Kendt og pålidelig"));
});
