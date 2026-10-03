/**
 * Værn efter generering. RENT og deterministisk: ingen AI, ingen netværk. Modellens svar behandles som ubetroet forslag:
 *  - citater, der ikke står ordret i kilden, FJERNES (ingen genererede citater)
 *  - tal, tidspunkter og citater i løbende tekst kontrolleres mod kildernes tekst (lib/engine/claims.ts) og markeres
 *  - henvisninger til ukendte kilder fjernes, HTML og links renses, metadata bringes inden for grænserne
 * Intet her gør en tekst "sand". Værnet finder det, der åbenlyst ikke kan dokumenteres, så redaktøren ved, hvor hun skal kigge.
 */
import { checkPost, PLATFORM_SPECS, postLength, type SocialPlatform } from "../article-meta";
import { countWords } from "../blocks/text";
import { groundClaims, summarizeClaims, verbatimIn } from "../engine/claims";
import { slugify } from "../slug";
import { PROFILES, type GenBlock, type GeneratedArticle, type GenSocial, type GenSource, type GenStats, type GenWarning, type ProfileId } from "./types";

const stripBody = (t: string) =>
  t.replace(/https?:\/\/\S+/gi, "").replace(/\bwww\.\S+/gi, "").replace(/\p{Extended_Pictographic}/gu, "").replace(/[ \t]{2,}/g, " ").trim();

/** Klip ved et ordskel, så der ikke står et halvt ord til sidst. */
export function clipAtWord(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max + 1);
  const space = cut.lastIndexOf(" ");
  return (space > max * 0.6 ? cut.slice(0, space) : cut.slice(0, max)).replace(/[\s,;:–-]+$/, "");
}

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

function fitSocial(platform: SocialPlatform, post: GenSocial | undefined, warn: (kode: string, tekst: string) => void): GenSocial | undefined {
  if (!post) return undefined;
  const spec = PLATFORM_SPECS[platform];
  const tags = post.hashtags.slice(0, spec.maxHashtags);
  // Reservér plads til linket, der tilføjes bagefter (X tæller et link som fast 23 tegn).
  const limit = platform === "x" ? spec.max - (spec.linkLength ?? 23) - 2 : spec.recommended;
  let tekst = stripBody(post.tekst);
  let changed = false;
  while (tekst.length > 20 && postLength(platform, { tekst, hashtags: tags }) > limit) {
    tekst = clipAtWord(tekst, Math.max(20, tekst.length - 12));
    changed = true;
  }
  if (changed) warn("some-kortet", `Opslaget til ${spec.label} var for langt og er kortet ned.`);
  const out = { tekst, hashtags: tags };
  const check = checkPost(platform, { ...out });
  if (check.errors.length) warn("some-graense", check.errors[0]);
  return out;
}

export type GuardrailLists = { tags: readonly string[]; geo: readonly string[] };

export function applyGuardrails(input: GeneratedArticle, sources: readonly GenSource[], profile: ProfileId, lists: GuardrailLists = { tags: [], geo: [] }): { artikel: GeneratedArticle; advarsler: GenWarning[]; statistik: GenStats } {
  const advarsler: GenWarning[] = [];
  const warn = (kode: string, tekst: string, niveau: GenWarning["niveau"] = "advarsel") => { advarsler.push({ kode, niveau, tekst }); };
  const rules = PROFILES[profile];
  const known = new Set(sources.map((s) => s.id));
  const evidence = sources.map((s) => ({ titel: s.titel, uddrag: s.tekst }));

  // ── Blokke ────────────────────────────────────────────────────────────────
  const blokke: GenBlock[] = [];
  let utenKilde = 0;
  let fjernedeCitater = 0;
  for (const b of input.blokke) {
    if (b.type === "mellemrubrik") {
      const tekst = stripBody(b.tekst);
      if (tekst) blokke.push({ type: "mellemrubrik", tekst });
    } else if (b.type === "citat") {
      const found = verbatimIn(b.tekst, evidence);
      if (!found) {
        fjernedeCitater++;
        warn("citat-fjernet", `Citatet »${clipAtWord(b.tekst, 110)}« står ikke ordret i kilderne og er fjernet.`, "fjernet");
        continue;
      }
      const owner = sources[found - 1].id;
      const kilder = b.kilder.filter((k) => known.has(k));
      blokke.push({ type: "citat", tekst: b.tekst, taler: b.taler, kilder: kilder.includes(owner) ? kilder : [owner] });
      if (!b.taler) warn("citat-uden-taler", `Citatet »${clipAtWord(b.tekst, 80)}« mangler navn på den, der siger det.`);
    } else {
      const tekst = stripBody(b.tekst);
      if (!tekst) continue;
      const kilder = b.kilder.filter((k) => known.has(k));
      if (kilder.length === 0) utenKilde++;
      blokke.push(b.type === "faktaboks" ? { type: "faktaboks", titel: stripBody(b.titel) || "Fakta", tekst, kilder } : { type: "afsnit", tekst, kilder });
    }
  }
  if (utenKilde > 0) warn("uden-kilde", `${utenKilde} afsnit har ingen kildehenvisning. Kontrollér ${utenKilde === 1 ? "det" : "dem"} ekstra nøje.`);

  // ── Overskrift og manchet ─────────────────────────────────────────────────
  const titel = stripBody(input.titel);
  const manchet = stripBody(input.manchet);
  if (titel.length > 110) warn("titel-lang", `Overskriften er ${titel.length} tegn. Hold den under 110.`);
  if (!manchet) warn("manchet-mangler", "Manchetten mangler.");
  else if (countWords(manchet) > rules.manchetOrd) warn("manchet-lang", `Manchetten er ${countWords(manchet)} ord; ønsket højst ${rules.manchetOrd}.`);

  // Gentaget manchet som første afsnit
  const first = blokke.findIndex((b) => b.type === "afsnit");
  if (manchet && first >= 0) {
    const b = blokke[first] as Extract<GenBlock, { type: "afsnit" }>;
    const m = norm(manchet);
    if (m.length > 25 && norm(b.tekst).startsWith(m.slice(0, Math.min(m.length, 90)))) {
      const rest = b.tekst.slice(manchet.length).replace(/^[\s.:–-]+/, "").trim();
      if (rest.length > 40) blokke[first] = { ...b, tekst: rest };
      else blokke.splice(first, 1);
      warn("manchet-gentaget", "Første afsnit gentog manchetten og er rettet.");
    }
  }

  // ── Tal, tidspunkter og citater i løbende tekst ──────────────────────────
  const bodyText = [titel, manchet, ...blokke.filter((b) => b.type === "afsnit" || b.type === "faktaboks").map((b) => (b as { tekst: string }).tekst)].join("\n\n");
  const claims = groundClaims(bodyText, evidence, { max: 60 });
  const unsupported = claims.filter((c) => c.status === "mangler");
  const quotes = unsupported.filter((c) => c.kind === "citat");
  const figures = unsupported.filter((c) => c.kind !== "citat");
  for (const q of quotes.slice(0, 5)) warn("citat-i-tekst", `Citat i teksten findes ikke ordret i kilderne: »${clipAtWord(q.tekst, 100)}«.`);
  if (figures.length > 0) warn("tal-mangler", `Tal og tidspunkter, der ikke står i kilderne: ${figures.slice(0, 8).map((c) => c.tekst).join(", ")}${figures.length > 8 ? " …" : ""}.`);
  const summary = summarizeClaims(claims);

  // ── Længde ────────────────────────────────────────────────────────────────
  const ord = blokke.reduce((n, b) => n + (b.type === "mellemrubrik" ? 0 : countWords(b.type === "faktaboks" ? `${b.titel} ${b.tekst}` : b.tekst)), 0);
  if (ord < rules.ord.min) warn("for-kort", `Artiklen er ${ord} ord, kortere end de ca. ${rules.ord.min} ord, profilen lægger op til.`);
  else if (rules.ord.max && ord > rules.ord.max) warn("for-lang", `Artiklen er ${ord} ord, længere end de ca. ${rules.ord.max} ord, profilen lægger op til.`);

  // ── Metadata ──────────────────────────────────────────────────────────────
  let seoTitel = stripBody(input.seoTitel);
  if (!seoTitel) { seoTitel = clipAtWord(titel, 60); warn("seo-titel-afledt", "SEO-titlen mangler og er afledt af overskriften."); }
  else if (seoTitel.length > 60) seoTitel = clipAtWord(seoTitel, 60);
  let seoBeskrivelse = stripBody(input.seoBeskrivelse);
  if (!seoBeskrivelse) { seoBeskrivelse = clipAtWord(manchet || titel, 155); warn("seo-beskrivelse-afledt", "Metabeskrivelsen mangler og er afledt af manchetten."); }
  else if (seoBeskrivelse.length > 155) seoBeskrivelse = clipAtWord(seoBeskrivelse, 155);
  else if (seoBeskrivelse.length < 70) warn("seo-beskrivelse-kort", `Metabeskrivelsen er kun ${seoBeskrivelse.length} tegn; 70-155 er bedst.`);
  const slug = slugify(input.slug || titel, 60) || slugify(titel, 60);
  const tldr = clipAtWord(stripBody(input.tldr) || manchet, 320);

  const canon = (values: readonly string[], available: readonly string[], max: number) => {
    const out: string[] = [];
    for (const v of values) {
      const hit = available.find((a) => a.toLowerCase() === v.toLowerCase());
      const name = hit ?? v;
      if (!out.some((o) => o.toLowerCase() === name.toLowerCase())) out.push(name);
      if (out.length >= max) break;
    }
    return out;
  };

  const opslag = { facebook: fitSocial("facebook", input.opslag.facebook, (k, t) => warn(k, t)), x: fitSocial("x", input.opslag.x, (k, t) => warn(k, t)) };

  const imageSources = new Set(sources.filter((s) => s.billeder.length > 0).map((s) => s.id));
  const billeder = input.billeder.filter((b) => known.has(b.kilde)).map((b) => ({ kilde: b.kilde, alt: clipAtWord(stripBody(b.alt), 125), billedtekst: clipAtWord(stripBody(b.billedtekst), 220) }));
  if (billeder.some((b) => !imageSources.has(b.kilde))) warn("billede-uden-reference", "Et billedforslag peger på en kilde uden billedreference. Brug det kun som idé.");

  const cited = new Set<string>();
  for (const b of blokke) if ("kilder" in b) for (const k of b.kilder) cited.add(k);
  const brugteKilder = input.brugteKilder.filter((k) => known.has(k));
  for (const k of cited) if (!brugteKilder.includes(k)) brugteKilder.push(k);
  if (brugteKilder.length === 0) warn("ingen-kilder", "Artiklen henviser ikke til nogen kilder.");

  const afsnit = blokke.filter((b) => b.type === "afsnit").length;
  return {
    artikel: {
      titel, manchet, blokke, seoTitel, seoBeskrivelse, slug, tldr,
      tags: canon(input.tags, lists.tags, 6),
      omraader: canon(input.omraader, lists.geo, 3),
      opslag, billeder, brugteKilder,
      mangler: input.mangler,
    },
    advarsler,
    statistik: { ord, afsnit, citater: blokke.filter((b) => b.type === "citat").length, stoettet: summary.stoettet, mangler: summary.mangler + fjernedeCitater, ukontrolleret: summary.ukontrolleret },
  };
}
