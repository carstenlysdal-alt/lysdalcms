import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import test, { after, before } from "node:test";
import zlib from "node:zlib";
import { db } from "../lib/db";
import { catalogRowToFeed, CATALOG_PACKS, feedTypeForAccess, replaceName, sourceTypeForArea } from "../lib/feeds/catalog";
import { matchesKeywords, parseFeedContent } from "../lib/feeds/parse";
import { parseFeedInput } from "../lib/feeds/input";
import { checkUrlShape, hostAllowed, isBlockedIp } from "../lib/net/ip-guard";
import { parseRobots, robotsAllows } from "../lib/net/robots";
import { safeFetch, userAgent } from "../lib/net/safe-fetch";
import { MemoryRateLimitStore, setRateLimitStore } from "../lib/ratelimit";
import { createInstance, createUser, installNextMocks, session } from "./helpers/mock-session";

installNextMocks();

type Store = typeof import("../lib/feeds/store");
type Fetcher = typeof import("../lib/feeds/fetch");
let store: Store;
let fetcher: Fetcher;
let instansId = "";
let otherId = "";
let strangerId = "";
let editor: Awaited<ReturnType<typeof createUser>>;
let leader: Awaited<ReturnType<typeof createUser>>;

// ── Mock-server (kun loopback; porten tillades eksplicit i testen) ──────────

const requests: Array<{ url: string; cookie: string | undefined; ua: string | undefined; host: string | undefined }> = [];
let server: http.Server;
let base = "";
const RSS = `<?xml version="1.0"?><rss version="2.0"><channel><title>Politi</title>
<item><title>Indbrud i Havnegade</title><link>https://example.dk/a</link><guid>g-1</guid><description><![CDATA[<p>Tyve <b>stjal</b> udstyr.</p>]]></description><pubDate>Tue, 30 Sep 2026 10:00:00 GMT</pubDate></item>
<item><title>Trafikuheld på Ringvejen</title><link>https://example.dk/b</link><guid>g-2</guid><description>To biler kolliderede.</description></item>
<item><title>Uden link</title><guid>g-3</guid><description>Mangler link.</description></item></channel></rss>`;

function handler(req: http.IncomingMessage, res: http.ServerResponse) {
  const url = req.url ?? "/";
  requests.push({ url, cookie: req.headers.cookie, ua: req.headers["user-agent"], host: req.headers.host });
  if (url === "/robots.txt") {
    res.setHeader("Content-Type", "text/plain");
    return void res.end("User-agent: *\nDisallow: /privat\nAllow: /privat/offentlig\n");
  }
  if (url === "/feed.xml") {
    res.setHeader("Content-Type", "application/rss+xml; charset=utf-8");
    res.setHeader("Set-Cookie", "session=hemmelig");
    return void res.end(RSS);
  }
  if (url === "/gzip.xml") {
    res.setHeader("Content-Type", "application/xml");
    res.setHeader("Content-Encoding", "gzip");
    return void res.end(zlib.gzipSync(RSS));
  }
  if (url === "/bombe.xml") {
    res.setHeader("Content-Type", "application/xml");
    res.setHeader("Content-Encoding", "gzip");
    return void res.end(zlib.gzipSync(Buffer.alloc(3 * 1024 * 1024, "a")));
  }
  if (url === "/stor.xml") {
    res.setHeader("Content-Type", "application/xml");
    res.write(Buffer.alloc(2 * 1024 * 1024, "a"));
    return void res.end(Buffer.alloc(2 * 1024 * 1024, "a"));
  }
  if (url === "/billede.png") {
    res.setHeader("Content-Type", "image/png");
    return void res.end("png");
  }
  if (url === "/hang") return; // svarer aldrig
  if (url === "/r/1") { res.statusCode = 302; res.setHeader("Location", "/feed.xml"); return void res.end(); }
  if (url === "/r/intern") { res.statusCode = 302; res.setHeader("Location", "http://169.254.169.254/latest/meta-data/"); return void res.end(); }
  if (url === "/r/fil") { res.statusCode = 302; res.setHeader("Location", "file:///etc/passwd"); return void res.end(); }
  if (url === "/r/anden-port") { res.statusCode = 302; res.setHeader("Location", "http://127.0.0.1:6379/"); return void res.end(); }
  if (url.startsWith("/r/kaede/")) { const n = Number(url.split("/").pop()); res.statusCode = 301; res.setHeader("Location", `/r/kaede/${n + 1}`); return void res.end(); }
  if (url === "/side") {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return void res.end("<html><head><title>Kommunens nyheder</title></head><body><main><h1>Ny skole</h1><p>Byrådet har besluttet at bygge en ny skole i 2027.</p></main></body></html>");
  }
  if (url === "/fejl") { res.statusCode = 503; return void res.end("nede"); }
  res.statusCode = 404;
  res.end("ikke fundet");
}

before(async () => {
  setRateLimitStore(new MemoryRateLimitStore());
  server = http.createServer(handler);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as AddressInfo).port;
  base = `http://127.0.0.1:${port}`;
  process.env.FEED_FETCH_LOOPBACK_PORTS = String(port);

  store = await import("../lib/feeds/store");
  fetcher = await import("../lib/feeds/fetch");
  instansId = (await createInstance("Fp")).id;
  otherId = (await createInstance("FpAndet")).id;
  strangerId = (await createInstance("FpFremmed")).id;
  editor = await createUser(instansId, "Ansvarshavende redaktør");
  leader = await createUser(instansId, "Redaktionsleder");
  await db.userInstanceAccess.create({ data: { userId: editor.id, instansId: otherId, createdBy: "test" } });
});

after(async () => {
  delete process.env.FEED_FETCH_LOOPBACK_PORTS;
  await new Promise<void>((resolve) => { server.closeAllConnections?.(); server.close(() => resolve()); });
  for (const id of [instansId, otherId, strangerId]) {
    await db.auditLog.deleteMany({ where: { instansId: id } });
    await db.signal.deleteMany({ where: { instansId: id } });
    await db.sourceProfile.deleteMany({ where: { instansId: id } });
    await db.feedDefinition.deleteMany({ where: { instansId: id } });
    await db.userInstanceAccess.deleteMany({ where: { instansId: id } });
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

// ── SSRF: adresser og URL-form ───────────────────────────────────────────────

test("ip-guard: private, interne og indlejrede adresser er lukkede; offentlige er åbne", () => {
  const blocked = [
    "0.0.0.0", "10.1.2.3", "100.64.0.1", "127.0.0.1", "127.9.9.9", "169.254.169.254", "172.16.0.1", "172.31.255.255", "192.168.1.1", "192.0.2.5",
    "198.18.0.1", "203.0.113.9", "224.0.0.1", "240.0.0.1", "255.255.255.255",
    "::", "::1", "::ffff:127.0.0.1", "::ffff:7f00:1", "::ffff:10.0.0.1", "64:ff9b::a00:1", "100::1", "2001::1", "2001:db8::1", "2002:7f00:1::1",
    "fc00::1", "fd12:3456::1", "fe80::1", "fec0::1", "ff02::1", "ikke-en-ip",
  ];
  for (const ip of blocked) assert.equal(isBlockedIp(ip), true, ip);
  for (const ip of ["8.8.8.8", "93.184.216.34", "172.32.0.1", "100.63.255.255", "2606:4700:4700::1111", "::ffff:8.8.8.8"]) assert.equal(isBlockedIp(ip), false, ip);
});

test("url-form: kun http(s), ingen brugeroplysninger, kun port 80/443, ingen interne navne, alle IP-skrivemåder normaliseres", () => {
  const bad = [
    "file:///etc/passwd", "ftp://example.dk/x", "gopher://example.dk", "data:text/plain,hej", "javascript:alert(1)", "http://bruger@example.dk/", "http://bruger:kode@example.dk/",
    "http://example.dk:22/", "http://example.dk:6379/", "http://example.dk:8080/", "http://localhost/", "http://a.localhost/", "http://x.local/", "http://x.internal/",
    "http://lysdalcms.railway.internal:3000/", "http://metadata.google.internal/", "http://enkeltnavn/", "ikke en url", "",
  ];
  for (const url of bad) assert.equal(checkUrlShape(url).ok, false, url);
  // IP-literaler normaliseres af URL-parseren og vurderes derefter som IP
  for (const url of ["http://2130706433/", "http://0x7f000001/", "http://017700000001/", "http://127.1/", "http://[::1]/", "http://[::ffff:127.0.0.1]/", "http://169.254.169.254/"]) {
    const shape = checkUrlShape(url);
    assert.equal(shape.ok, true, url);
    if (shape.ok) assert.ok(shape.literalIp && isBlockedIp(shape.literalIp), `${url} -> ${shape.literalIp}`);
  }
  const good = checkUrlShape("https://Politi.DK./rss");
  assert.equal(good.ok, true);
  if (good.ok) assert.equal(good.hostname, "politi.dk");
  const idn = checkUrlShape("https://æblegrød.dk/");
  assert.equal(idn.ok && idn.hostname, "xn--blegrd-oua3m.dk");
  assert.equal(hostAllowed("www.slagelse.dk", ["slagelse.dk"]), true);
  assert.equal(hostAllowed("evilslagelse.dk", ["slagelse.dk"]), false);
  assert.equal(hostAllowed("hvad.som.helst", []), true);
});

// ── safeFetch mod mock-server ────────────────────────────────────────────────

test("safeFetch: henter, sender ærligt User-Agent og ingen cookies, ignorerer Set-Cookie, og pakker gzip ud", async () => {
  const before = requests.length;
  const res = await safeFetch(`${base}/feed.xml`);
  assert.equal(res.ok, true);
  if (res.ok) assert.match(res.body.toString("utf8"), /Indbrud i Havnegade/);
  const second = await safeFetch(`${base}/feed.xml`);
  assert.equal(second.ok, true);
  const seen = requests.slice(before);
  assert.ok(seen.every((r) => r.cookie === undefined), "Set-Cookie sendes aldrig tilbage");
  assert.ok(seen.every((r) => r.ua === userAgent()), "ærligt User-Agent");
  const gz = await safeFetch(`${base}/gzip.xml`);
  assert.equal(gz.ok && gz.body.toString("utf8").includes("Trafikuheld"), true);
});

test("safeFetch: lukker ned for forkert indholdstype, for store svar, gzip-bomber, hængende svar og fejlkoder", async () => {
  const png = await safeFetch(`${base}/billede.png`);
  assert.deepEqual(png.ok ? null : png.code, "indholdstype");
  const big = await safeFetch(`${base}/stor.xml`, { maxBytes: 1024 * 1024 });
  assert.deepEqual(big.ok ? null : big.code, "for_stor");
  const bomb = await safeFetch(`${base}/bombe.xml`, { maxBytes: 1024 * 1024 });
  assert.deepEqual(bomb.ok ? null : bomb.code, "for_stor");
  const hang = await safeFetch(`${base}/hang`, { timeoutMs: 300 });
  assert.deepEqual(hang.ok ? null : hang.code, "timeout");
  const down = await safeFetch(`${base}/fejl`);
  assert.equal(down.ok, false);
  if (!down.ok) { assert.equal(down.code, "http_fejl"); assert.equal(down.status, 503); assert.ok(!down.message.includes("nede")); }
});

test("safeFetch: redirects følges (højst 5) og gennemgår samme tjek; interne mål og skemaskift afvises uden at gengive noget", async () => {
  const ok = await safeFetch(`${base}/r/1`);
  assert.equal(ok.ok, true);
  for (const path of ["/r/intern", "/r/fil", "/r/anden-port"]) {
    const res = await safeFetch(`${base}${path}`);
    assert.equal(res.ok, false, path);
    if (!res.ok) assert.ok(res.code === "blokeret", `${path}: ${res.code}`);
  }
  const chain = await safeFetch(`${base}/r/kaede/1`);
  assert.deepEqual(chain.ok ? null : chain.code, "omdirigeringer");
  // Direkte kald mod interne adresser lukkes, før der oprettes forbindelse
  const before = requests.length;
  for (const url of ["http://169.254.169.254/latest/meta-data/", "http://127.0.0.1:6379/", "http://[::1]:5432/", "http://localhost/", "file:///etc/passwd"]) {
    const res = await safeFetch(url);
    assert.equal(res.ok, false, url);
    if (!res.ok) assert.ok(!/169\.254|127\.0\.0\.1|::1/.test(res.message), "ingen intern adresse i fejlteksten");
  }
  assert.equal(requests.length, before, "ingen af dem nåede serveren");
});

test("safeFetch: DNS-svar valideres, og forbindelsen sker til den validerede adresse (pinning mod DNS-rebinding)", async () => {
  const port = Number(new URL(base).port);
  let calls = 0;
  // Værtsnavnet peger på loopback på den tilladte test-port: forbindelsen sker til det valgte svar, og der slås kun op én gang
  const ok = await safeFetch(`http://feed.eksempel.test:${port}/feed.xml`, {}, { lookup: async () => { calls++; return [{ address: "127.0.0.1", family: 4 }]; } });
  assert.equal(ok.ok, true);
  assert.equal(calls, 1, "ét opslag; Node slår ikke selv op igen");
  assert.equal(requests.at(-1)?.host, `feed.eksempel.test:${port}`, "Host er det oprindelige værtsnavn");
  // Blandet svar [offentlig, privat] afvises som helhed
  for (const addrs of [[{ address: "8.8.8.8", family: 4 }, { address: "10.0.0.5", family: 4 }], [{ address: "192.168.0.10", family: 4 }], [{ address: "::ffff:10.0.0.1", family: 6 }], [{ address: "169.254.169.254", family: 4 }]]) {
    const res = await safeFetch("http://offentlig.eksempel.test/rss", {}, { lookup: async () => addrs });
    assert.equal(res.ok, false);
    if (!res.ok) assert.equal(res.code, "blokeret");
  }
  const none = await safeFetch("http://findes-ikke.eksempel.test/rss", {}, { lookup: async () => { throw new Error("ENOTFOUND"); } });
  assert.equal(none.ok === false && none.code, "netvaerk");
});

test("robots.txt: mest specifikke regel vinder, og Allow slår Disallow ved lige længde", () => {
  const rules = parseRobots("User-agent: *\nDisallow: /privat\nAllow: /privat/offentlig\nDisallow: /*.pdf$\n\nUser-agent: lokalcms\nDisallow: /kun-os\n");
  assert.deepEqual(rules, [{ allow: false, path: "/kun-os" }], "gruppen for vores egen agent går forud for *");
  const star = parseRobots("User-agent: *\nDisallow: /privat\nAllow: /privat/offentlig\nDisallow: /*.pdf$\n");
  assert.equal(robotsAllows(star, "/nyheder"), true);
  assert.equal(robotsAllows(star, "/privat/hemmeligt"), false);
  assert.equal(robotsAllows(star, "/privat/offentlig/a"), true);
  assert.equal(robotsAllows(star, "/filer/a.pdf"), false);
  assert.equal(robotsAllows(star, "/filer/a.pdf?x=1"), true);
  assert.equal(robotsAllows([], "/hvad/som/helst"), true);
  assert.equal(robotsAllows(parseRobots("User-agent: *\nDisallow:"), "/x"), true, "tom Disallow = alt tilladt");
});

// ── Feed-parsing ─────────────────────────────────────────────────────────────

test("feed-parser: RSS, Atom og JSON Feed giver ens elementer; HTML renses; entiteter og DOCTYPE afvises", () => {
  const rss = parseFeedContent(RSS);
  assert.equal(rss.ok, true);
  if (rss.ok) {
    assert.equal(rss.titel, "Politi");
    assert.equal(rss.items.length, 3);
    assert.equal(rss.items[0].tekst, "Tyve stjal udstyr.");
    assert.equal(rss.items[0].dato?.toISOString(), "2026-09-30T10:00:00.000Z");
    assert.equal(rss.items[2].url, null, "element uden link beholdes uden url");
  }
  const atom = parseFeedContent(`<feed xmlns="http://www.w3.org/2005/Atom"><title>Kommunen</title><entry><title>Høring</title><id>urn:1</id><link rel="alternate" href="https://k.dk/h"/><updated>2026-10-01T08:00:00Z</updated><summary>Frist &amp; vilkår</summary><category term="plan"/></entry></feed>`);
  assert.equal(atom.ok && atom.items[0].url, "https://k.dk/h");
  assert.equal(atom.ok && atom.items[0].tekst, "Frist & vilkår");
  assert.deepEqual(atom.ok && atom.items[0].kategorier, ["plan"]);
  const json = parseFeedContent(JSON.stringify({ title: "J", items: [{ id: "1", title: "Nyt", url: "https://j.dk/1", summary: "Kort", date_published: "2026-10-02T00:00:00Z" }] }));
  assert.equal(json.ok && json.items[0].titel, "Nyt");
  // Farlige links hentes aldrig og gemmes ikke som url
  const evil = parseFeedContent(`<rss><channel><item><title>X</title><link>javascript:alert(1)</link><guid>1</guid></item></channel></rss>`);
  assert.equal(evil.ok && evil.items[0].url, null);
  // XXE / billion laughs
  const xxe = parseFeedContent(`<?xml version="1.0"?><!DOCTYPE r [<!ENTITY a "aaaa"><!ENTITY b "&a;&a;&a;">]><rss><channel><item><title>&b;</title><guid>1</guid></item></channel></rss>`);
  assert.equal(xxe.ok, false);
  assert.equal(parseFeedContent("").ok, false);
  assert.equal(parseFeedContent("<html><body>hej</body></html>").ok, false);
  const many = parseFeedContent(`<rss><channel>${Array.from({ length: 100 }, (_, i) => `<item><title>T${i}</title><guid>${i}</guid></item>`).join("")}</channel></rss>`);
  assert.equal(many.ok && many.items.length, 40, "højst 40 elementer pr. hentning");
});

test("nøgleord: skal indeholde et af ordene og må ikke indeholde andre (uden hensyn til store/små bogstaver)", () => {
  const item = { titel: "Indbrud i Havnegade", tekst: "Politiet efterlyser vidner." };
  assert.equal(matchesKeywords(item, [], []), true);
  assert.equal(matchesKeywords(item, ["havnegade"], []), true);
  assert.equal(matchesKeywords(item, ["slagelse"], []), false);
  assert.equal(matchesKeywords(item, ["indbrud"], ["vidner"]), false);
});

// ── Katalog ──────────────────────────────────────────────────────────────────

test("katalog: begge registre er med, og rækkerne bliver inaktive kladder uden adresse med fornuftige typer", () => {
  const counts = Object.fromEntries(CATALOG_PACKS.map((p) => [p.id, p.rows.length]));
  assert.deepEqual(counts, { slagelse: 74, naestved: 93 });
  for (const pack of CATALOG_PACKS) {
    for (const row of pack.rows) {
      const feed = catalogRowToFeed(row);
      assert.equal(feed.aktiv, false);
      assert.equal(feed.url, null);
      assert.ok(feed.navn.length >= 2 && feed.noter && feed.noter.length <= 300);
      assert.ok([1, 2, 3].includes(feed.prioritet));
    }
  }
  assert.equal(feedTypeForAccess("RSS; medie-API kan søges"), "rss");
  assert.equal(feedTypeForAccess("REST/WFS/WMS"), "api");
  assert.equal(feedTypeForAccess("Web-monitor"), "web");
  assert.equal(sourceTypeForArea("Politi", "x"), "politi");
  assert.equal(sourceTypeForArea("Beredskab", "x"), "beredskab_112");
  assert.equal(sourceTypeForArea("Kommunalpolitik", "x"), "kommune_dagsorden");
  assert.equal(replaceName("Slagelse Kommune og SLAGELSE", "Slagelse", "Køge"), "Køge Kommune og KØGE");
  assert.equal(replaceName("uændret", "", "Køge"), "uændret");
  const first = CATALOG_PACKS[0].rows[0];
  const swapped = catalogRowToFeed({ ...first, kilde: "Slagelse Brand & Redning" }, { replace: { from: "Slagelse", to: "Køge" } });
  assert.equal(swapped.navn, "Køge Brand & Redning");
});

test("feed-input: en kladde må mangle adresse, men et aktivt feed må ikke; prioritet valideres", () => {
  assert.equal(parseFeedInput({ navn: "Kladde", type: "rss", aktiv: false }).ok, true);
  assert.equal(parseFeedInput({ navn: "Aktiv", type: "rss", aktiv: true }).ok, false);
  assert.equal(parseFeedInput({ navn: "Prio", type: "mail", prioritet: 4 }).ok, false);
  const p = parseFeedInput({ navn: "Prio", type: "web", url: "https://x.dk", prioritet: "1", kategori: "  Politi " });
  assert.equal(p.ok && p.value.prioritet, 1);
  assert.equal(p.ok && p.value.kategori, "Politi");
});

// ── Kildepakke: massehandlinger, import, kopiering, hentning ─────────────────

test("import af katalog: kladder, ingen dubletter, erstatning af by-navn, kun med rettighed", async () => {
  const user = await authorized(editor);
  const res = await store.importCatalog(user, "slagelse", { maxPri: 0, replaceFrom: "Slagelse", replaceTo: "Testby" });
  assert.equal(res.ok, true);
  const rows = await db.feedDefinition.findMany({ where: { instansId } });
  assert.ok(rows.length > 5 && rows.length < 74);
  assert.ok(rows.every((r) => !r.aktiv && r.url === null && r.prioritet === 1));
  assert.ok(rows.some((r) => r.navn.includes("Testby")) && !rows.some((r) => /slagelse/i.test(r.navn)));
  const again = await store.importCatalog(user, "slagelse", { maxPri: 0, replaceFrom: "Slagelse", replaceTo: "Testby" });
  assert.equal(again.ok && again.antal, 0, "anden import tilføjer ingenting");
  assert.equal((await db.feedDefinition.count({ where: { instansId } })), rows.length);
  assert.equal((await store.importCatalog(user, "findes-ikke")).ok, false);
  const lead = await authorized(leader);
  const denied = await store.importCatalog(lead, "naestved");
  assert.equal(denied.ok, false);
  assert.equal(await db.feedDefinition.count({ where: { instansId } }), rows.length);
  assert.ok(!(await db.auditLog.findMany({ where: { instansId, action: "feed.import" } })).some((l) => JSON.stringify(l.detail).includes("http")));
});

test("massehandlinger: aktivering springer kladder uden adresse over, og ændringer holdes til egen instans", async () => {
  const user = await authorized(editor);
  const withUrl = await db.feedDefinition.create({ data: { instansId, navn: "Har adresse", type: "rss", url: `${base}/feed.xml`, inkluder: [], ekskluder: [], aktiv: false } });
  const foreign = await db.feedDefinition.create({ data: { instansId: strangerId, navn: "Fremmed", type: "rss", url: "https://x.dk/rss", inkluder: [], ekskluder: [], aktiv: false } });
  const noUrl = await db.feedDefinition.findFirstOrThrow({ where: { instansId, url: null } });

  const res = await store.bulkUpdateFeeds(user, [withUrl.id, noUrl.id, foreign.id], { aktiv: true });
  assert.equal(res.ok, true);
  assert.equal((await db.feedDefinition.findUniqueOrThrow({ where: { id: withUrl.id } })).aktiv, true);
  assert.equal((await db.feedDefinition.findUniqueOrThrow({ where: { id: noUrl.id } })).aktiv, false, "uden adresse");
  assert.equal((await db.feedDefinition.findUniqueOrThrow({ where: { id: foreign.id } })).aktiv, false, "andre instanser røres ikke");
  assert.equal((await store.bulkUpdateFeeds(user, [noUrl.id], { aktiv: true })).ok, false);

  assert.equal((await store.bulkUpdateFeeds(user, [withUrl.id], { prioritet: 1, kategori: "  Kommune " })).ok, true);
  const changed = await db.feedDefinition.findUniqueOrThrow({ where: { id: withUrl.id } });
  assert.equal(changed.prioritet, 1);
  assert.equal(changed.kategori, "Kommune");
  assert.equal((await store.bulkUpdateFeeds(user, [withUrl.id], { prioritet: 9 })).ok, false);
  assert.equal((await store.bulkUpdateFeeds(user, [], { aktiv: false })).ok, false);
  assert.equal((await store.bulkUpdateFeeds(user, [withUrl.id], {})).ok, false);
  assert.equal((await store.bulkUpdateFeeds(await authorized(leader), [withUrl.id], { aktiv: false })).ok, false);

  const del = await store.deleteFeeds(user, [foreign.id]);
  assert.equal(del.ok && del.antal, 0, "kan ikke slette andre instansers feeds");
  await db.feedDefinition.delete({ where: { id: foreign.id } });
});

test("kopiering til anden by: kun byer med adgang, kopierne er slået fra, navne erstattes, og dubletter springes over", async () => {
  const user = await authorized(editor);
  await db.feedDefinition.create({ data: { instansId, navn: "Testby Kommune dagsorden", type: "web", url: "https://testby.dk/dagsorden", inkluder: ["Testby", "byråd"], ekskluder: ["jobs"], aktiv: true, kategori: "Kommune", prioritet: 2, omraadeTekst: "Testby", noter: "Fra Testby" } });
  await db.sourceProfile.create({ data: { instansId, navn: "Testby Kommune", type: "kommune_pressemeddelelse", score: 77, note: "God kilde" } });

  assert.equal((await store.cloneFeeds(user, { targetInstansId: strangerId })).ok, false, "ingen adgang til fremmed by");
  assert.equal((await store.cloneFeeds(user, { targetInstansId: instansId })).ok, false, "kan ikke kopiere til sig selv");
  assert.equal((await store.cloneFeeds(await authorized(leader), { targetInstansId: otherId })).ok, false, "redaktionsleder har ikke rettigheden");

  const res = await store.cloneFeeds(user, { targetInstansId: otherId, replaceFrom: "Testby", replaceTo: "Køge", keepUrls: true, includeRatings: true });
  assert.equal(res.ok, true);
  const copied = await db.feedDefinition.findMany({ where: { instansId: otherId } });
  assert.equal(copied.length, await db.feedDefinition.count({ where: { instansId } }));
  assert.ok(copied.every((c) => c.aktiv === false), "kopier er altid slået fra");
  const dagsorden = copied.find((c) => c.navn === "Køge Kommune dagsorden");
  assert.ok(dagsorden, "by-navn erstattet i navn");
  assert.equal(dagsorden?.url, "https://testby.dk/dagsorden", "adresser røres ikke");
  assert.deepEqual(dagsorden?.inkluder, ["Køge", "byråd"]);
  assert.deepEqual(dagsorden?.ekskluder, ["jobs"]);
  assert.equal(dagsorden?.omraadeTekst, "Køge");
  assert.equal(dagsorden?.noter, "Fra Køge");
  assert.equal(dagsorden?.kategori, "Kommune");
  const rating = await db.sourceProfile.findFirst({ where: { instansId: otherId, navn: "Testby Kommune" } });
  assert.equal(rating?.score, 77);
  const again = await store.cloneFeeds(user, { targetInstansId: otherId, replaceFrom: "Testby", replaceTo: "Køge" });
  assert.equal(again.ok && again.antal, 0, "anden kopiering springer det eksisterende over");

  const noUrls = await store.cloneFeeds(user, { targetInstansId: otherId, ids: [(await db.feedDefinition.findFirstOrThrow({ where: { instansId, navn: "Har adresse" } })).id], replaceFrom: "x", replaceTo: "y", keepUrls: false });
  assert.equal(noUrls.ok, true);
  const log = (await db.auditLog.findMany({ where: { instansId: otherId, action: "feed.clone" } }))[0];
  assert.ok(log && !JSON.stringify(log.detail).includes("http"), "audit uden adresser");
});

test("Hent nu: RSS bliver til maskinindsamlede, ugodkendte signaler; nøgleord filtrerer; gentagelse giver ingen dubletter", async () => {
  const user = await authorized(editor);
  const feed = await db.feedDefinition.create({ data: { instansId, navn: "Mock-politi", type: "rss", url: `${base}/feed.xml`, sourceType: "trafik", inkluder: ["indbrud", "uheld"], ekskluder: [], aktiv: true, omraadeTekst: "Havnegade" } });
  const res = await fetcher.fetchFeedNow(user, feed.id);
  assert.equal(res.ok, true);
  if (res.ok) { assert.equal(res.nye, 2); assert.equal(res.filtreret, 1, "elementet uden link sorteres fra"); }
  const signals = await db.signal.findMany({ where: { instansId, kilde: "Mock-politi" }, orderBy: { overskrift: "asc" } });
  assert.equal(signals.length, 2);
  assert.ok(signals.every((s) => s.maskinindsamlet && !s.breaking && !s.notable && s.godkendtAf === null && s.godkendtTid === null && s.ingestKeyId === null));
  assert.equal(signals[0].brødtekst, "Tyve stjal udstyr.");
  assert.equal(signals[0].sourceType, "trafik");
  const row = await db.feedDefinition.findUniqueOrThrow({ where: { id: feed.id } });
  assert.equal(row.sidsteStatus, "ok");
  assert.equal(row.sidsteAntal, 2);
  assert.ok(row.sidstHentet);

  const second = await fetcher.fetchFeedNow(user, feed.id);
  assert.equal(second.ok && second.nye, 0);
  assert.equal(second.ok && second.uaendrede, 2);
  assert.equal(await db.signal.count({ where: { instansId, kilde: "Mock-politi" } }), 2);
  const fetched = requests.filter((r) => r.url === "/robots.txt").length;
  assert.ok(fetched >= 2, "robots.txt tjekkes ved hver hentning");
});

test("Hent nu: webside bliver ét signal, robots.txt og fejl respekteres, og fejl gemmes som kort tekst", async () => {
  const user = await authorized(editor);
  const page = await db.feedDefinition.create({ data: { instansId, navn: "Mock-kommune", type: "web", url: `${base}/side`, sourceType: "kommune_pressemeddelelse", inkluder: [], ekskluder: [], aktiv: true } });
  const res = await fetcher.fetchFeedNow(user, page.id);
  assert.equal(res.ok && res.nye, 1);
  const sig = await db.signal.findFirstOrThrow({ where: { instansId, kilde: "Mock-kommune" } });
  assert.equal(sig.overskrift, "Kommunens nyheder");
  assert.match(sig.brødtekst ?? "", /Byrådet har besluttet at bygge en ny skole/);

  const blocked = await db.feedDefinition.create({ data: { instansId, navn: "Forbudt", type: "web", url: `${base}/privat/side`, inkluder: [], ekskluder: [], aktiv: true } });
  const denied = await fetcher.fetchFeedNow(user, blocked.id);
  assert.equal(denied.ok, false);
  assert.match((await db.feedDefinition.findUniqueOrThrow({ where: { id: blocked.id } })).sidsteBesked ?? "", /robots/);

  const down = await db.feedDefinition.create({ data: { instansId, navn: "Nede", type: "rss", url: `${base}/fejl`, inkluder: [], ekskluder: [], aktiv: true } });
  const failed = await fetcher.fetchFeedNow(user, down.id);
  assert.equal(failed.ok, false);
  const stored = await db.feedDefinition.findUniqueOrThrow({ where: { id: down.id } });
  assert.equal(stored.sidsteStatus, "fejl");
  assert.ok(!(stored.sidsteBesked ?? "").includes("nede"), "svarindhold gemmes aldrig");

  const html = await db.feedDefinition.create({ data: { instansId, navn: "Forkert type", type: "rss", url: `${base}/side`, inkluder: [], ekskluder: [], aktiv: true } });
  const wrong = await fetcher.fetchFeedNow(user, html.id);
  assert.equal(wrong.ok === false && /Webside/.test(wrong.error), true, "HTML i et RSS-feed giver en hjælpsom fejl");

  const agent = await db.feedDefinition.create({ data: { instansId, navn: "Agent-API", type: "api", url: "https://api.example.dk", inkluder: [], ekskluder: [], aktiv: true } });
  const nope = await fetcher.fetchFeedNow(user, agent.id);
  assert.equal(nope.ok === false && /agenten/.test(nope.error), true);
});

test("Hent nu: kun med rettighed, kun egne feeds, og blokerede adresser nås aldrig", async () => {
  const user = await authorized(editor);
  const foreign = await db.feedDefinition.create({ data: { instansId: strangerId, navn: "Fremmed feed", type: "rss", url: `${base}/feed.xml`, inkluder: [], ekskluder: [], aktiv: true } });
  assert.equal((await fetcher.fetchFeedNow(user, foreign.id)).ok, false, "andre instansers feeds kan ikke hentes");
  const own = await db.feedDefinition.findFirstOrThrow({ where: { instansId, navn: "Mock-politi" } });
  assert.equal((await fetcher.fetchFeedNow(await authorized(leader), own.id)).ok, false, "kræver controlroom.manage");

  const internal = await db.feedDefinition.create({ data: { instansId, navn: "Intern", type: "rss", url: "http://169.254.169.254/latest/meta-data/", inkluder: [], ekskluder: [], aktiv: true } });
  const before = requests.length;
  const res = await fetcher.fetchFeedNow(user, internal.id);
  assert.equal(res.ok, false);
  const row = await db.feedDefinition.findUniqueOrThrow({ where: { id: internal.id } });
  assert.equal(row.sidsteStatus, "fejl");
  assert.ok(!/169\.254/.test(row.sidsteBesked ?? ""), "den interne adresse gengives aldrig");
  assert.equal(requests.length, before);

  const all = await fetcher.fetchActiveFeeds(user);
  assert.equal(all.ok, true);
  if (all.ok) assert.ok(all.resultater.length >= 3 && all.resultater.length <= 10);
});
