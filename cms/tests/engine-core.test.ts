import assert from "node:assert/strict";
import test from "node:test";
import { extractClaims, groundClaims, summarizeClaims } from "../lib/engine/claims";
import { keywords, overlapScore } from "../lib/engine/archive";
import { headlineChecks, labelForLix, readability } from "../lib/engine/quality";
import {
  applyOverride, findProfile, gradeFromScore, normalizeHost, rateSource, sourceBasisChecks, type SourceProfileLite,
} from "../lib/engine/source-rating";

// ── Kilderating ──────────────────────────────────────────────────────────────

test("gradeFromScore: A>=80, B>=60, C>=40, ellers D (og klemmer til 0-100)", () => {
  assert.equal(gradeFromScore(100), "A");
  assert.equal(gradeFromScore(80), "A");
  assert.equal(gradeFromScore(79), "B");
  assert.equal(gradeFromScore(60), "B");
  assert.equal(gradeFromScore(59), "C");
  assert.equal(gradeFromScore(40), "C");
  assert.equal(gradeFromScore(39), "D");
  assert.equal(gradeFromScore(-20), "D");
  assert.equal(gradeFromScore(Number.NaN), "D");
  assert.equal(gradeFromScore(900), "A");
});

test("normalizeHost: fjerner www, afviser ikke-http og ugyldige værter", () => {
  assert.equal(normalizeHost("https://www.Politi.dk/sydsjaelland/nyheder"), "politi.dk");
  assert.equal(normalizeHost("dmi.dk"), "dmi.dk");
  assert.equal(normalizeHost("javascript:alert(1)"), null);
  assert.equal(normalizeHost("ftp://politi.dk"), null);
  assert.equal(normalizeHost(""), null);
  assert.equal(normalizeHost("ikke en vært"), null);
});

test("rateSource: standard pr. kildetype, og politi/112 markeres som personfølsomme", () => {
  const politi = rateSource({ sourceType: "politi" });
  assert.equal(politi.grade, "A");
  assert.equal(politi.foelsom, true);
  assert.equal(rateSource({ sourceType: "beredskab_112" }).foelsom, true);
  assert.equal(rateSource({ sourceType: "kommune_dagsorden" }).foelsom, false);
  assert.equal(rateSource({ sourceType: "kommune_pressemeddelelse" }).grade, "B");
  assert.equal(rateSource({ sourceType: "forening" }).grade, "C");
  assert.equal(rateSource({ sourceType: "borger" }).grade, "D");
});

test("rateSource: kendt vært, nyhedsbureau og ukendt kilde", () => {
  assert.equal(rateSource({ url: "https://www.dmi.dk/varsler" }).grade, "A");
  assert.equal(rateSource({ url: "https://www.slagelse.kommune.dk/nyheder" }).grade, "A");
  assert.equal(rateSource({ url: "https://politi.dk/x" }).foelsom, true);
  assert.equal(rateSource({ navn: "Ritzau" }).grade, "B");
  assert.equal(rateSource({ navn: "Reuters" }).grade, "B");
  const unknown = rateSource({ navn: "Facebook-gruppen Nyt fra Byen", url: "https://facebook.com/groups/x" });
  assert.equal(unknown.grade, "C");
  assert.equal(unknown.fra, "standard");
  assert.match(unknown.begrundelse, /Ukendt kilde/);
});

test("kilderegister går forud for standardreglerne; domæne går forud for navn; inaktive ignoreres", () => {
  const profiles: SourceProfileLite[] = [
    { navn: "Havneforeningen", type: "forening", domaene: "havneforening.dk", score: 82, note: "Kendt og pålidelig" },
    { navn: "Lokalavisen", type: "lokalt_medie", domaene: "lokalavisen.dk", score: 30 },
    { navn: "Gammel kilde", type: "andet", domaene: "gammel.dk", score: 90, aktiv: false },
  ];
  const r = rateSource({ navn: "Havneforeningen", url: "https://www.havneforening.dk/nyt", sourceType: "forening" }, profiles);
  assert.equal(r.grade, "A");
  assert.equal(r.fra, "register");
  assert.match(r.begrundelse, /Kilderegisteret: Havneforeningen \(score 82\)/);
  // Underdomæne rammer også domænet; navn uden URL rammer via navn (uden hensyn til store/små bogstaver og diakritik).
  assert.equal(findProfile({ url: "https://nyt.lokalavisen.dk/a" }, profiles)?.navn, "Lokalavisen");
  assert.equal(findProfile({ navn: "LOKALAVISEN" }, profiles)?.navn, "Lokalavisen");
  assert.equal(rateSource({ navn: "Lokalavisen", sourceType: "lokalt_medie" }, profiles).grade, "D");
  assert.equal(findProfile({ url: "https://gammel.dk" }, profiles), null, "inaktiv post bruges ikke");
  // Domænematch må ikke ramme et andet domæne, der blot ender på de samme bogstaver.
  assert.equal(findProfile({ url: "https://minlokalavisen.dk" }, profiles), null);
});

test("applyOverride: redaktørens karakter gælder, og begrundelsen fortæller det", () => {
  const base = rateSource({ sourceType: "forening" });
  const up = applyOverride(base, "A");
  assert.equal(up.grade, "A");
  assert.equal(up.score, 90);
  assert.match(up.begrundelse, /Valgt af redaktøren \(var C/);
  assert.equal(applyOverride(base, null), base);
  assert.equal(applyOverride(base, "C"), base);
});

test("sourceBasisChecks: primærkilde, antal, svage kilder, uddrag og personfølsomhed", () => {
  const status = (checks: ReturnType<typeof sourceBasisChecks>, id: string) => checks.find((c) => c.id === id)?.status;
  const none = sourceBasisChecks([]);
  assert.equal(status(none, "primaer"), "fail");
  assert.equal(status(none, "uafhaengige"), "fail");
  assert.equal(status(none, "uddrag"), "fail");

  const good = sourceBasisChecks([{ grade: "A", hasExcerpt: true }, { grade: "B", hasExcerpt: true }]);
  assert.deepEqual(good.map((c) => c.status), ["ok", "ok", "ok", "ok"]);

  const weak = sourceBasisChecks([{ grade: "D", hasExcerpt: false }]);
  assert.equal(status(weak, "ikke-kun-svage"), "fail");
  assert.equal(status(weak, "uafhaengige"), "warn");

  const mixed = sourceBasisChecks([{ grade: "B", hasExcerpt: true }, { grade: "C", hasExcerpt: false, foelsom: true }]);
  assert.equal(status(mixed, "primaer"), "warn");
  assert.equal(status(mixed, "uddrag"), "warn");
  assert.equal(status(mixed, "foelsom"), "warn");
});

// ── Tal, tidspunkter og citater mod originalen ──────────────────────────────

const ORIGINAL = "Mindst fem erhvervslejemål og lagre er blevet brudt op natten til tirsdag mellem kl. 01:30 og 04:00. Tyvene stjal udstyr til over 400.000 kr. Journalnummer 1900-73241-00214-25. Vagtchef Jens B. Poulsen siger: »Vi kan konstatere, at der har været tale om en meget målrettet aktion, hvor gerningsmændene har anvendt en mørk kassevogn.«";

const ARTICLE = "Tirsdag morgen mødte ansatte ved mindst fire håndværksvirksomheder ind til smadrede døre. Indbruddene skete mellem kl. 01.30 og 04:00. Udstyr for 400.000 kr. er stjålet. »Vi kan konstatere, at der har været tale om en meget målrettet aktion, hvor gerningsmændene har anvendt en mørk kassevogn,« siger politikommissær Jens B. Poulsen. Ring på 1-1-4 med journalnummer 1900-73241-00214-25. Mere end 12 biler blev set.";

test("extractClaims: tal, klokkeslæt og citater udtrækkes; telefon, journalnummer og tal i citater springes over", () => {
  const claims = extractClaims(ARTICLE);
  const keys = claims.map((c) => `${c.kind}:${c.key}`);
  assert.ok(keys.includes("tal:4"), "talordet 'fire' + navneord");
  assert.ok(keys.includes("tal:400000"), "tusindtalsseparator fjernes");
  assert.ok(keys.includes("tal:12"));
  assert.ok(keys.includes("tid:01:30") && keys.includes("tid:04:00"), "kl. 01.30 og 04:00 normaliseres ens");
  assert.equal(claims.filter((c) => c.kind === "citat").length, 1);
  assert.ok(!keys.includes("tal:1900") && !keys.includes("tal:114"), "nummerrækker springes over");
  assert.ok(!keys.some((k) => k === "tal:73241"), "journalnummer");
});

test("extractClaims: korte citater (under fire ord) og 'og/eller' efter talord tæller ikke", () => {
  const claims = extractClaims("Han sagde »det passer« og tre og fire. De to af dem kom.");
  assert.equal(claims.filter((c) => c.kind === "citat").length, 0);
  assert.ok(!claims.some((c) => c.key === "3"), "'tre og' er ikke et talt navneord");
});

test("groundClaims: uden uddrag er alt ukontrolleret (ikke 'forkert')", () => {
  const checks = groundClaims(ARTICLE, [{ titel: "Døgnrapport" }, { titel: "Ritzau", uddrag: "  " }]);
  assert.ok(checks.length > 0);
  assert.ok(checks.every((c) => c.status === "ukontrolleret" && c.kilde === null));
  assert.deepEqual(summarizeClaims(checks), { stoettet: 0, mangler: 0, ukontrolleret: checks.length, total: checks.length });
});

test("groundClaims: understøttede, manglende og afvigende udsagn mod originalen", () => {
  const checks = groundClaims(ARTICLE, [{ titel: "Døgnrapport", uddrag: ORIGINAL }]);
  const get = (kind: string, needle: string) => checks.find((c) => c.kind === kind && c.tekst.toLowerCase().includes(needle));

  assert.equal(get("tal", "400.000")?.status, "stoettet");
  assert.equal(get("tal", "400.000")?.kilde, 1);
  assert.equal(get("tid", "01.30")?.status, "stoettet", "01.30 og 01:30 er samme tidspunkt");
  assert.equal(get("tid", "04:00")?.status, "stoettet");
  assert.equal(get("citat", "målrettet")?.status, "stoettet", "citatet er ordret (interpunktion ignoreres)");

  // Artiklen skriver 'fire', kilden 'fem': det er netop afvigelsen redaktøren skal se.
  const fire = get("tal", "fire");
  assert.equal(fire?.status, "mangler");
  assert.match(fire!.note, /Tallet står ikke/);
  assert.equal(get("tal", "12")?.status, "mangler");

  const sum = summarizeClaims(checks);
  assert.equal(sum.stoettet + sum.mangler + sum.ukontrolleret, sum.total);
  assert.equal(sum.ukontrolleret, 0);
});

test("groundClaims: et citat med ændret ordlyd er 'mangler' og får en tydelig forklaring; helt fremmed citat har ingen kilde", () => {
  const close = groundClaims("»Vi kan konstatere, at der har været tale om en meget målrettet aktion, hvor gerningsmændene brugte en stor kassevogn,« siger han.", [{ titel: "Rapport", uddrag: ORIGINAL }]);
  assert.equal(close[0].status, "mangler");
  assert.equal(close[0].kilde, 1);
  assert.match(close[0].note, /Næsten ordret/);

  const foreign = groundClaims("»Dette udsagn findes slet ikke i nogen af kilderne her,« siger hun.", [{ titel: "Rapport", uddrag: ORIGINAL }]);
  assert.equal(foreign[0].status, "mangler");
  assert.equal(foreign[0].kilde, null);
  assert.match(foreign[0].note, /findes ikke i nogen/);
});

test("groundClaims: talord i kilden matcher tal i artiklen ('fem' = 5), og antallet begrænses", () => {
  const ok = groundClaims("Der blev brudt ind hos 5 virksomheder.", [{ titel: "K", uddrag: "Mindst fem erhvervslejemål blev ramt." }]);
  assert.equal(ok.find((c) => c.tekst.startsWith("5"))?.status, "stoettet");
  const many = Array.from({ length: 80 }, (_, i) => `${i + 100} biler`).join(". ");
  assert.equal(groundClaims(many, [{ titel: "K", uddrag: "x" }]).length, 40);
  assert.equal(groundClaims(many, [{ titel: "K", uddrag: "x" }], { max: 5 }).length, 5);
});

// ── Læsbarhed og rubrik ─────────────────────────────────────────────────────

test("readability: LIX = ord/sætning + procent lange ord, og forkortelser deler ikke sætninger", () => {
  const r = readability("Politiet kom kl. 14.45 til Havnegade. Indbrud i fem virksomheder blev anmeldt. Ingen er anholdt.");
  assert.equal(r.sentences, 3);
  assert.equal(r.words, 15);
  // Lange ord (> 6 bogstaver): Politiet, Havnegade, Indbrud, virksomheder, anmeldt, anholdt -> 6 af 15
  assert.equal(r.longWords, 6);
  assert.equal(r.lix, Math.round(15 / 3 + (6 * 100) / 15));
  assert.equal(readability("").lix, 0);
});

test("readability: lange sætninger fremhæves, og niveauerne følger LIX-grænserne", () => {
  const long = `${Array.from({ length: 40 }, (_, i) => `ord${i}`).join(" ")}.`;
  assert.equal(readability(long).longSentences.length, 1);
  assert.equal(readability("Kort. Kort.").longSentences.length, 0);
  assert.deepEqual([20, 30, 40, 50, 60].map(labelForLix), ["Meget let", "Let", "Middel", "Svær", "Meget svær"]);
  assert.equal(readability("Kort. Enkel. Let.").fitForNews, true);
});

test("headlineChecks: længde, versaler, udråbstegn, lokke-ord og kolon", () => {
  const by = (t: string) => Object.fromEntries(headlineChecks(t).map((c) => [c.id, c.status]));
  assert.equal(by("Politi undersøger indbrudsbølge ved havnen i Næstved").laengde, "ok");
  assert.equal(by("").laengde, "fail");
  assert.equal(by("Kort").laengde, "fail");
  assert.equal(by("BRAND på havnen i Næstved lørdag aften nu").versaler, "warn");
  assert.equal(by("Politiet undersøger indbrud ved havnen!").udraab, "warn");
  assert.equal(by("Chokerende fund ved havnen i Næstved i nat").clickbait, "warn");
  assert.equal(by("Havnen: Indbrud: Politi: Vidner søges").kolon, "warn");
  assert.equal(by("Politi undersøger indbrudsbølge ved havnen i Næstved").clickbait, "ok");
});

// ── Emneoverlap ─────────────────────────────────────────────────────────────

test("emneoverlap: bøjninger mødes, og ét tilfældigt ord giver ikke høj score", () => {
  const q = keywords("Indbrudsbølge på Havnegade i Næstved: politiet efterlyser vidner til indbrud ved havnekajen", "Indbrudsbølge ved havnen");
  assert.ok(q.length > 0);
  const strong = overlapScore(q, { titel: "Indbrud ved havnekajen i Næstved", manchet: "Vidner efterlyses efter indbrud på Havnegade" });
  const weak = overlapScore(q, { titel: "Kagebod åbner i Slagelse", manchet: "Ny bager på Havnegade" });
  const none = overlapScore(q, { titel: "Fodboldholdet vandt", manchet: "Sejr på hjemmebane" });
  assert.ok(strong >= 60, `stærkt match: ${strong}`);
  assert.ok(weak < 40, `svagt match: ${weak}`);
  assert.equal(none, 0);
  assert.equal(overlapScore([], { titel: "Hvad som helst" }), 0);
});
