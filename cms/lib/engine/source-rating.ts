/**
 * Kilderating (0-100 -> A-D). KLIENT-SIKKER og ren: ingen database, ingen AI. Samme input giver altid samme output.
 *
 * Rækkefølge: 1) kilderegisteret (SourceProfile, redaktionens egen vurdering, via domæne eller navn),
 *             2) indbyggede regler for kildetype / kendt domæne / nyhedsbureau, 3) forsigtigt standardfald (C).
 * Ratingen siger noget om KILDENS troværdighed som udgangspunkt. Den erstatter aldrig redaktionel kontrol og
 * betyder ikke, at et konkret udsagn er rigtigt (det kontrolleres separat i lib/engine/claims.ts).
 */
export type SourceGrade = "A" | "B" | "C" | "D";

export const GRADE_BANDS = { A: 80, B: 60, C: 40 } as const;

export const GRADE_INFO: Record<SourceGrade, { label: string; kraever: string }> = {
  A: { label: "Primærkilde", kraever: "Kan danne grundlag. Kontrollér stadig tal, navne og tidspunkter mod originalen." },
  B: { label: "Troværdig sekundærkilde", kraever: "Bekræft de centrale oplysninger hos en primærkilde, når det er muligt." },
  C: { label: "Kræver bekræftelse", kraever: "Skal bekræftes af mindst én anden uafhængig kilde, før det publiceres." },
  D: { label: "Uverificeret", kraever: "Må ikke stå alene. Verificér hos en primærkilde, og hør de implicerede parter." },
};

/** Midtpunkt pr. karakter, når redaktøren vælger en karakter frem for en score. */
export const GRADE_DEFAULT_SCORE: Record<SourceGrade, number> = { A: 90, B: 70, C: 50, D: 25 };

export function clampScore(score: number): number {
  if (!Number.isFinite(score)) return 0;
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function gradeFromScore(score: number): SourceGrade {
  const s = clampScore(score);
  if (s >= GRADE_BANDS.A) return "A";
  if (s >= GRADE_BANDS.B) return "B";
  if (s >= GRADE_BANDS.C) return "C";
  return "D";
}

export function isGrade(value: unknown): value is SourceGrade {
  return value === "A" || value === "B" || value === "C" || value === "D";
}

/** Kilder fra registeret (kun de felter, ratingen bruger). */
export type SourceProfileLite = { navn: string; type: string; domaene: string | null; score: number; note?: string | null; aktiv?: boolean };

export type RatingInput = {
  navn?: string | null;
  url?: string | null;
  /** SOURCE_TYPES (lib/ingest/schema.ts) eller "nyhedsbureau" | "borger" | "meddeler". */
  sourceType?: string | null;
};

export type SourceRating = {
  score: number;
  grade: SourceGrade;
  label: string;
  /** Hvorfra ratingen stammer, i klartekst (vises til redaktøren). */
  begrundelse: string;
  kraever: string;
  fra: "register" | "standard";
  /** Kilden kan indeholde personoplysninger om sigtede/ofre (politi, 112): læs for personhenførbare oplysninger før brug. */
  foelsom: boolean;
};

/** Standardscore pr. kildetype. Dækker alle SOURCE_TYPES plus nyhedsbureau, borgertip og meddeler. */
export const TYPE_DEFAULTS: Record<string, { score: number; label: string; foelsom?: boolean }> = {
  kommune_dagsorden: { score: 90, label: "Kommunal dagsorden" },
  kommune_pressemeddelelse: { score: 72, label: "Kommunal pressemeddelelse" },
  politi: { score: 90, label: "Politiet", foelsom: true },
  beredskab_112: { score: 90, label: "Beredskab / 112", foelsom: true },
  trafik: { score: 80, label: "Trafikmelding" },
  vejr: { score: 90, label: "Vejrvarsel" },
  forening: { score: 45, label: "Forening" },
  klub: { score: 45, label: "Klub" },
  lokalt_medie: { score: 65, label: "Andet lokalt medie" },
  nyhedsbureau: { score: 75, label: "Nyhedsbureau" },
  meddeler: { score: 50, label: "Kendt meddeler" },
  egen: { score: 70, label: "Egen tidligere dækning" },
  borger: { score: 25, label: "Borgertip" },
  andet: { score: 40, label: "Anden kilde" },
};

/** Kendte værter: [suffiks, score, navn, følsom]. Længste suffiks vinder. */
const KNOWN_HOSTS: ReadonlyArray<readonly [string, number, string, boolean?]> = [
  ["politi.dk", 90, "Politiet", true],
  ["dmi.dk", 92, "DMI"],
  ["kommune.dk", 85, "Kommune"],
  ["regionsjaelland.dk", 85, "Region Sjælland"],
  ["sst.dk", 90, "Sundhedsstyrelsen"],
  ["ft.dk", 90, "Folketinget"],
  ["stm.dk", 88, "Statsministeriet"],
  ["dst.dk", 92, "Danmarks Statistik"],
  ["retsinformation.dk", 95, "Retsinformation"],
  ["borger.dk", 88, "Borger.dk"],
  ["europa.eu", 88, "EU"],
  ["ritzau.dk", 75, "Ritzau"],
];

/** Forslag til kilderegisteret (knappen "Importér standardkilder"). Afspejler de indbyggede regler, men kan redigeres frit. */
export const DEFAULT_PROFILES: ReadonlyArray<{ navn: string; type: string; domaene: string | null; score: number }> = [
  { navn: "Politiet", type: "politi", domaene: "politi.dk", score: 90 },
  { navn: "DMI", type: "vejr", domaene: "dmi.dk", score: 92 },
  { navn: "Kommunale hjemmesider", type: "kommune_dagsorden", domaene: "kommune.dk", score: 85 },
  { navn: "Region Sjælland", type: "andet", domaene: "regionsjaelland.dk", score: 85 },
  { navn: "Sundhedsstyrelsen", type: "andet", domaene: "sst.dk", score: 90 },
  { navn: "Folketinget", type: "andet", domaene: "ft.dk", score: 90 },
  { navn: "Statsministeriet", type: "andet", domaene: "stm.dk", score: 88 },
  { navn: "Danmarks Statistik", type: "andet", domaene: "dst.dk", score: 92 },
  { navn: "Retsinformation", type: "andet", domaene: "retsinformation.dk", score: 95 },
  { navn: "Borger.dk", type: "andet", domaene: "borger.dk", score: 88 },
  { navn: "EU", type: "andet", domaene: "europa.eu", score: 88 },
  { navn: "Ritzau", type: "nyhedsbureau", domaene: "ritzau.dk", score: 75 },
  { navn: "Reuters", type: "nyhedsbureau", domaene: "reuters.com", score: 75 },
  { navn: "AP", type: "nyhedsbureau", domaene: "apnews.com", score: 75 },
  { navn: "AFP", type: "nyhedsbureau", domaene: null, score: 75 },
];

const WIRE = /\b(ritzau|reuters|afp|npa|tt)\b|^ap$|associated press/i;

/** Værtsnavn uden "www." og med små bogstaver, eller null hvis det ikke er en gyldig http(s)-URL/vært. */
export function normalizeHost(input: string | null | undefined): string | null {
  const raw = (input ?? "").trim();
  if (!raw) return null;
  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    return /^[a-z0-9.-]+\.[a-z]{2,}$/.test(host) ? host : null;
  } catch {
    return null;
  }
}

function fold(s: string): string {
  return s.toLowerCase().normalize("NFKD").replace(/\p{M}/gu, "").replace(/[^a-z0-9æøå]+/g, " ").trim();
}

function hostMatches(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`);
}

/** Finder den bedste aktive registerpost: domænematch (længste domæne) går forud for navnematch. */
export function findProfile(input: RatingInput, profiles: readonly SourceProfileLite[]): SourceProfileLite | null {
  const active = profiles.filter((p) => p.aktiv !== false);
  const host = normalizeHost(input.url);
  if (host) {
    const byDomain = active
      .filter((p) => p.domaene && hostMatches(host, p.domaene.toLowerCase()))
      .sort((a, b) => (b.domaene?.length ?? 0) - (a.domaene?.length ?? 0));
    if (byDomain[0]) return byDomain[0];
  }
  const name = fold(input.navn ?? "");
  if (name.length >= 2) {
    const byName = active.find((p) => fold(p.navn) === name);
    if (byName) return byName;
  }
  return null;
}

function build(score: number, begrundelse: string, fra: SourceRating["fra"], foelsom: boolean): SourceRating {
  const s = clampScore(score);
  const grade = gradeFromScore(s);
  return { score: s, grade, label: GRADE_INFO[grade].label, begrundelse, kraever: GRADE_INFO[grade].kraever, fra, foelsom };
}

export function rateSource(input: RatingInput, profiles: readonly SourceProfileLite[] = []): SourceRating {
  const typeDefault = input.sourceType ? TYPE_DEFAULTS[input.sourceType] : undefined;
  const host = normalizeHost(input.url);
  const hostEntry = host ? [...KNOWN_HOSTS].sort((a, b) => b[0].length - a[0].length).find(([suffix]) => hostMatches(host, suffix)) : undefined;
  const sensitive = Boolean(typeDefault?.foelsom || hostEntry?.[3]);

  const profile = findProfile(input, profiles);
  if (profile) {
    const profileSensitive = sensitive || Boolean(TYPE_DEFAULTS[profile.type]?.foelsom);
    return build(profile.score, `Kilderegisteret: ${profile.navn} (score ${clampScore(profile.score)})${profile.note ? ` — ${profile.note}` : ""}`, "register", profileSensitive);
  }
  if (typeDefault) return build(typeDefault.score, `Standard for kildetypen: ${typeDefault.label}`, "standard", sensitive);
  if (hostEntry) return build(hostEntry[1], `Kendt afsender: ${hostEntry[2]} (${hostEntry[0]})`, "standard", sensitive);
  if (input.navn && WIRE.test(input.navn.trim())) return build(TYPE_DEFAULTS.nyhedsbureau.score, `Standard: nyhedsbureau (${input.navn.trim()})`, "standard", false);
  return build(TYPE_DEFAULTS.andet.score, "Ukendt kilde: ikke i kilderegisteret. Standardværdi, til du har vurderet den.", "standard", false);
}

/** Karakter, som redaktøren kan overstyre pr. kilde i artiklen: gælder frem for registeret og standarden. */
export function applyOverride(rating: SourceRating, override: SourceGrade | null | undefined): SourceRating {
  if (!override || override === rating.grade) return rating;
  return { ...rating, grade: override, score: GRADE_DEFAULT_SCORE[override], label: GRADE_INFO[override].label, kraever: GRADE_INFO[override].kraever, begrundelse: `Valgt af redaktøren (var ${rating.grade}: ${rating.begrundelse})`, fra: "register" };
}

// ── Kildegrundlag (presseetisk tjekliste, deterministisk) ─────────────────────

export type BasisStatus = "ok" | "warn" | "fail";
export type BasisCheck = { id: string; label: string; status: BasisStatus; hint: string };

export type BasisSource = { grade: SourceGrade; hasExcerpt: boolean; foelsom?: boolean };

/** Tjekker kildegrundlaget bag en artikel. Giver advarsler — blokerer aldrig publicering (som SEO-tjekket). */
export function sourceBasisChecks(sources: readonly BasisSource[]): BasisCheck[] {
  const n = sources.length;
  const count = (g: SourceGrade) => sources.filter((s) => s.grade === g).length;
  const withExcerpt = sources.filter((s) => s.hasExcerpt).length;
  const solid = count("A") + count("B");

  const checks: BasisCheck[] = [];
  checks.push({
    id: "primaer",
    label: "Primærkilde",
    status: count("A") > 0 ? "ok" : n === 0 ? "fail" : solid > 0 ? "warn" : "fail",
    hint: count("A") > 0 ? "Mindst én kilde er rated A." : n === 0 ? "Ingen kilder tilføjet." : solid > 0 ? "Ingen A-kilde. Bekræft helst hos en primærkilde." : "Kun C/D-kilder. Find en primærkilde.",
  });
  checks.push({
    id: "uafhaengige",
    label: "Flere kilder",
    status: n >= 2 ? "ok" : n === 1 ? "warn" : "fail",
    hint: n >= 2 ? `${n} kilder.` : n === 1 ? "Kun én kilde. Overvej en uafhængig bekræftelse." : "Ingen kilder.",
  });
  checks.push({
    id: "ikke-kun-svage",
    label: "Ikke kun svage kilder",
    status: n > 0 && solid === 0 ? (count("D") === n ? "fail" : "warn") : "ok",
    hint: n > 0 && solid === 0 ? (count("D") === n ? "Alle kilder er uverificerede (D)." : "Ingen kilder på A/B-niveau.") : "Mindst én A/B-kilde.",
  });
  checks.push({
    id: "uddrag",
    label: "Originalen er indlagt",
    status: n === 0 ? "fail" : withExcerpt === n ? "ok" : withExcerpt > 0 ? "warn" : "fail",
    hint: n === 0 ? "Ingen kilder." : withExcerpt === n ? "Alle kilder har uddrag, så tal og citater kan kontrolleres." : withExcerpt > 0 ? `${withExcerpt} af ${n} kilder har uddrag. Faktatjek dækker kun dem.` : "Ingen uddrag, så tal og citater kan ikke kontrolleres mod originalen.",
  });
  if (sources.some((s) => s.foelsom)) {
    checks.push({ id: "foelsom", label: "Personoplysninger", status: "warn", hint: "Politi/112-kilde: tjek for navne på sigtede, ofre og mindreårige, før noget bruges." });
  }
  return checks;
}
