import "server-only";
import { z } from "zod";
import type { AuthorizedUser } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { articleMetaSchema, metaToDb } from "@/lib/article-meta";
import { blocksSchema } from "@/lib/blocks/schema";
import { countWords } from "@/lib/blocks/text";
import { loadCategoryTree } from "@/lib/category-tree";
import { db } from "@/lib/db";
import { rateSource } from "@/lib/engine/source-rating";
import { categorySlugsFor, uniqueSlug } from "@/lib/engine/start";
import { generateArticleDraft } from "@/lib/ai/generate";
import { createAiTextClient, NO_AI_MESSAGE } from "@/lib/ai/provider";
import { AI_RESTRICTED_SOURCE_TYPES } from "@/lib/ingest/schema";
import type { AiFailureReason, AiTextClient } from "@/lib/frontpage/ai-client";
import { isAiRestrictedCategoryTree } from "@/lib/marking";
import { can, PERMISSIONS } from "@/lib/permissions";
import { composeGeneration, type PromptOverrides } from "@/lib/prompts/compose";
import { loadPromptOverrides } from "@/lib/prompts/store";
import { rateLimit } from "@/lib/ratelimit";
import { loadActiveSourceProfiles } from "@/lib/sources/store";
import { cleanText, isHttpUrl, textToParagraphHtml } from "@/lib/validation/text";
import { applyGuardrails } from "./guardrails";
import { buildSourcePack } from "./sources";
import { LIMITS, PROFILE_IDS, PROFILES, SOURCE_KINDS, type GeneratedArticle, type GenerationResult, type GenSource, type GenWarning, type RawSource } from "./types";

/**
 * Artikelgeneratoren: rettigheder, spærringer, kørsel og oprettelse af kladde. Genererer og gemmer ALDRIG noget udgivet:
 * en kladde får status "Idé", mærkningen "AI-assisteret" og en tom godkender, så den først kan udgives, når en redaktør har godkendt den.
 */
const RUN_TTL_DAYS = 30;

const imageSchema = z.object({ url: z.string().max(2000).refine(isHttpUrl), alt: z.string().max(300).nullish(), billedtekst: z.string().max(400).nullish() });
export const generateRequestSchema = z.object({
  profil: z.enum(PROFILE_IDS),
  vinkel: z.string().max(LIMITS.briefChars * 3).nullish(),
  kategoriId: z.string().max(64).nullish(),
  kilder: z.array(z.object({
    kind: z.enum(SOURCE_KINDS),
    signalId: z.string().max(64).nullish(),
    titel: z.string().max(400),
    udgiver: z.string().max(200).nullish(),
    url: z.string().max(2000).nullish(),
    dato: z.string().max(10).nullish(),
    type: z.string().max(40).nullish(),
    tekst: z.string().max(LIMITS.perSourceChars * 2),
    billeder: z.array(imageSchema).max(8).default([]),
  })).min(1, "Tilføj mindst én kilde.").max(12),
});
export type GenerateRequest = z.input<typeof generateRequestSchema>;

export type GenerateCode = "forbudt" | "ugyldig" | "rate" | "ingen-noegle" | "ai-fejl" | "spaerret" | "grundlag";
export type GenerateResponse =
  | { ok: true; runId: string; resultat: GenerationResult; kilder: GenSource[]; udloeber: string }
  | { ok: false; code: GenerateCode; error: string };

const fail = (code: GenerateCode, error: string): GenerateResponse => ({ ok: false, code, error });

const FAILURE_TEXT: Record<AiFailureReason, string> = {
  "ingen-noegle": NO_AI_MESSAGE,
  timeout: "AI nåede ikke at skrive artiklen i tide. Prøv igen, eller brug færre og kortere kilder.",
  "ugyldig-json": "AI gav et uforståeligt svar. Prøv igen.",
  schema: "AI's svar overholdt ikke formatet (der skal være overskrift, manchet og mindst to afsnit). Prøv igen.",
  "api-fejl": "AI-tjenesten er midlertidigt utilgængelig. Prøv igen om lidt.",
  "tomt-svar": "AI gav intet svar. Prøv igen.",
};

export type GenerateDeps = { client?: AiTextClient | null; prompts?: PromptOverrides; skipRateLimit?: boolean; timeoutMs?: number; retries?: number; sleep?: (ms: number) => Promise<void> };

async function audit(user: AuthorizedUser, action: string, targetId: string | null, label: string, detail: Record<string, string | number | boolean | null>) {
  try {
    await writeAudit(db, { instansId: user.instansId, actorId: user.id, actorLabel: user.name, action, targetId, targetLabel: label, detail });
  } catch (error) {
    console.error("[generate] auditlog fejlede", error instanceof Error ? error.message : "ukendt");
  }
}

const isoDay = (v: string | null | undefined) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(new Date(v).getTime()) ? v : null);

export async function runGeneration(user: AuthorizedUser, request: unknown, deps: GenerateDeps = {}): Promise<GenerateResponse> {
  if (!can(user, PERMISSIONS.ARTICLE_CREATE) || !can(user, PERMISSIONS.ARTICLE_AI_USE)) return fail("forbudt", "Du har ikke adgang til at generere artikler med AI.");
  const parsed = generateRequestSchema.safeParse(request);
  if (!parsed.success) return fail("ugyldig", parsed.error.issues[0]?.message ?? "Ugyldig forespørgsel.");
  const req = parsed.data;
  const instansId = user.instansId;

  if (!deps.skipRateLimit) {
    const limited = await rateLimit({ bucket: "article-generate", key: user.id, limit: 12, windowMs: 10 * 60_000 });
    if (!limited.ok) return fail("rate", `Du har genereret mange artikler på kort tid. Vent ${limited.retryAfterSec} sekunder, og prøv igen.`);
  }

  // Spærring: Krimi og Sundhed (valgt kategori) må ikke have AI-skrevet tekst.
  if (req.kategoriId) {
    const tree = await loadCategoryTree(instansId, req.kategoriId);
    if (!tree) return fail("ugyldig", "Sektionen findes ikke.");
    if (isAiRestrictedCategoryTree(tree)) return fail("spaerret", "AI-skrevne artikler er ikke tilladt i Krimi og retsvæsen samt Sundhed. Skriv historien selv, og brug AI til faktatjek og rubrikker.");
  }

  // Kilder: signaler hentes fra databasen (klientens tekst bruges aldrig for dem), og alt rates server-side.
  const profiles = await loadActiveSourceProfiles(instansId);
  const raw: RawSource[] = [];
  for (const k of req.kilder) {
    let titel = cleanText(k.titel, 300);
    let udgiver = k.udgiver ? cleanText(k.udgiver, 160) || null : null;
    let url = k.url && isHttpUrl(k.url) ? k.url : null;
    let dato = isoDay(k.dato);
    let type = k.type ? cleanText(k.type, 40) || null : null;
    let tekst = k.tekst;
    if (k.kind === "signal") {
      const s = k.signalId ? await db.signal.findFirst({ where: { id: k.signalId, instansId } }) : null;
      if (!s) return fail("ugyldig", "Et af signalerne findes ikke længere.");
      titel = s.overskrift;
      udgiver = s.kilde;
      url = s.kildeUrl && isHttpUrl(s.kildeUrl) ? s.kildeUrl : null;
      dato = (s.kildeTidspunkt ?? s.createdAt).toISOString().slice(0, 10);
      type = s.sourceType;
      tekst = `${s.overskrift}\n\n${s.brødtekst ?? ""}`;
    }
    const rated = rateSource({ navn: udgiver ?? titel, url, sourceType: type }, profiles);
    // Politi, beredskab/112 og andre følsomme afsendere (også på domæne, uanset valgt kildetype) kan ikke danne grundlag for AI-tekst.
    if ((type && (AI_RESTRICTED_SOURCE_TYPES as readonly string[]).includes(type)) || rated.foelsom) {
      return fail("spaerret", `"${titel}" er en politi- eller 112-kilde. AI-udkast baseret på dem er spærret; skriv historien selv, og brug kilden som baggrund.`);
    }
    raw.push({ kind: k.kind, signalId: k.kind === "signal" ? k.signalId ?? null : null, titel: titel || "Uden titel", udgiver, url, dato, type, tekst, rating: { grade: rated.grade, score: rated.score }, billeder: k.billeder.map((b) => ({ url: b.url, alt: b.alt ?? null, billedtekst: b.billedtekst ?? null })) });
  }

  const pack = buildSourcePack(raw, req.profil);
  if (!pack.ok) return fail("grundlag", pack.error);

  const [category, tags, geo, prompts] = await Promise.all([
    req.kategoriId ? db.category.findFirst({ where: { id: req.kategoriId, instansId }, include: { parent: true } }) : Promise.resolve(null),
    db.tag.findMany({ where: { instansId }, select: { navn: true }, orderBy: { navn: "asc" }, take: 300 }),
    db.geoTag.findMany({ where: { instansId }, select: { navn: true }, orderBy: { navn: "asc" }, take: 100 }),
    deps.prompts ? Promise.resolve(deps.prompts) : loadPromptOverrides(instansId),
  ]);

  const client = deps.client === undefined ? createAiTextClient({ task: "editor" }) : deps.client;
  const udbyder = client ? (client.providerId ?? "injiceret") : null;
  const vinkel = req.vinkel ? cleanText(req.vinkel, LIMITS.briefChars, { multiline: true }) || null : null;
  const composed = composeGeneration(req.profil, prompts);
  const result = await generateArticleDraft(
    {
      profil: req.profil,
      kilder: pack.kilder,
      vinkel,
      sektion: category ? (category.parent ? `${category.parent.navn} › ${category.navn}` : category.navn) : null,
      omraade: null,
      eksisterendeTags: tags.map((t) => t.navn),
      eksisterendeGeo: geo.map((g) => g.navn),
    },
    { client, prompts, timeoutMs: deps.timeoutMs, retries: deps.retries, sleep: deps.sleep },
  );

  const tilpasset = composed.custom.join(",");
  if (!result.ok) {
    await audit(user, "article.ai.generate", null, PROFILES[req.profil].titel, { profil: req.profil, kilder: pack.kilder.length, udfald: `fejl:${result.reason}`, udbyder, ...(tilpasset ? { tilpasset } : {}) });
    return result.reason === "ingen-noegle"
      ? fail("ingen-noegle", NO_AI_MESSAGE)
      : fail("ai-fejl", result.reason === "api-fejl" && result.userMessage ? result.userMessage : FAILURE_TEXT[result.reason]);
  }

  const guarded = applyGuardrails(result.value, pack.kilder, req.profil, { tags: tags.map((t) => t.navn), geo: geo.map((g) => g.navn) });
  const advarsler: GenWarning[] = [...pack.advarsler.map((tekst): GenWarning => ({ kode: "kildegrundlag", niveau: "advarsel", tekst })), ...guarded.advarsler];
  const promptVersion = tilpasset ? `${composed.version}+tilpasset` : composed.version;
  const resultat: GenerationResult = { profil: req.profil, artikel: guarded.artikel, advarsler, statistik: guarded.statistik, promptVersion, modelId: result.modelId ?? null };

  // Ryd udløbne kørsler (kildetekster opbevares kun i en begrænset periode), og gem denne.
  await db.generationRun.deleteMany({ where: { instansId, udloebTid: { lt: new Date() } } });
  const udloebTid = new Date(Date.now() + RUN_TTL_DAYS * 86_400_000);
  const run = await db.generationRun.create({
    data: {
      instansId, userId: user.id, profil: req.profil, vinkel, kategoriId: req.kategoriId ?? null,
      kilder: pack.kilder as never, resultat: guarded.artikel as never, advarsler: advarsler as never, statistik: guarded.statistik as never,
      promptVersion, modelId: result.modelId ?? null, udbyder, tokensInd: result.usage?.inputTokens ?? null, tokensUd: result.usage?.outputTokens ?? null, udloebTid,
    },
    select: { id: true },
  });
  await audit(user, "article.ai.generate", run.id, PROFILES[req.profil].titel, { profil: req.profil, kilder: pack.kilder.length, udfald: "ok", udbyder, advarsler: advarsler.length, ...(result.usage ? { tokensInd: result.usage.inputTokens, tokensUd: result.usage.outputTokens } : {}), ...(tilpasset ? { tilpasset } : {}) });
  return { ok: true, runId: run.id, resultat, kilder: pack.kilder, udloeber: udloebTid.toISOString() };
}

// ── Kladde ud fra en kørsel ──────────────────────────────────────────────────

export type DraftResult = { ok: true; articleId: string; findesAllerede: boolean } | { ok: false; error: string };

export function blocksFromGenerated(artikel: GeneratedArticle, kilder: readonly GenSource[]) {
  const byId = new Map(kilder.map((k) => [k.id, k]));
  const out: Array<{ id: string; type: string; data: Record<string, unknown> }> = [];
  let n = 0;
  const id = () => `gen-${++n}`;
  for (const b of artikel.blokke) {
    if (b.type === "afsnit") out.push({ id: id(), type: "paragraph", data: { content: textToParagraphHtml(b.tekst) } });
    else if (b.type === "mellemrubrik") out.push({ id: id(), type: "heading", data: { text: b.tekst, level: 2 } });
    else if (b.type === "faktaboks") out.push({ id: id(), type: "factbox", data: { title: b.titel, content: b.tekst } });
    else {
      const source = byId.get(b.kilder[0] ?? "");
      out.push({ id: id(), type: "quote", data: { quote: b.tekst, ...(b.taler ? { attribution: b.taler } : {}), ...(source?.url ? { kildeUrl: source.url } : {}), ...(source?.dato ? { dato: source.dato } : {}) } });
    }
  }
  return blocksSchema.parse(out);
}

const referenceFor = (k: GenSource) => k.url ?? `${k.kind === "pdf" ? "PDF" : k.kind === "tekst" ? "Indsat tekst" : "Kilde"}: ${k.titel}`.slice(0, 300);

export async function createDraftFromRun(user: AuthorizedUser, runId: string, opts: { kategoriId?: string | null } = {}): Promise<DraftResult> {
  if (!can(user, PERMISSIONS.ARTICLE_CREATE)) return { ok: false, error: "Du har ikke rettigheder til at oprette artikler." };
  const instansId = user.instansId;
  const run = await db.generationRun.findFirst({ where: { id: String(runId), instansId, userId: user.id } });
  if (!run) return { ok: false, error: "Kørslen findes ikke længere. Generér artiklen igen." };
  if (run.articleId) {
    const existing = await db.article.findFirst({ where: { id: run.articleId, instansId }, select: { id: true } });
    if (existing) return { ok: true, articleId: existing.id, findesAllerede: true };
  }

  const artikel = run.resultat as unknown as GeneratedArticle;
  const kilder = run.kilder as unknown as GenSource[];
  const profil = PROFILES[run.profil as keyof typeof PROFILES] ?? PROFILES.nyhed;

  // Sektion: den valgte, ellers den kildetypen peger på. Krimi/Sundhed kan aldrig få AI-tekst.
  const wanted = opts.kategoriId ?? run.kategoriId;
  let kategoriId: string | null = null;
  if (wanted) {
    const row = await db.category.findFirst({ where: { id: wanted, instansId }, select: { id: true } });
    if (!row) return { ok: false, error: "Sektionen findes ikke." };
    kategoriId = row.id;
  } else {
    const slugs = categorySlugsFor(kilder.find((k) => k.type)?.type);
    const rows = await db.category.findMany({ where: { instansId, slug: { in: slugs } }, select: { id: true, slug: true } });
    kategoriId = slugs.map((s) => rows.find((r) => r.slug === s)).find(Boolean)?.id ?? null;
  }
  if (kategoriId) {
    const tree = await loadCategoryTree(instansId, kategoriId);
    if (tree && isAiRestrictedCategoryTree(tree)) return { ok: false, error: "AI-skrevne artikler er ikke tilladt i Krimi og retsvæsen samt Sundhed." };
  }

  const [tagRows, geoRows] = await Promise.all([
    artikel.tags.length ? db.tag.findMany({ where: { instansId, navn: { in: artikel.tags } }, select: { id: true, navn: true } }) : Promise.resolve([]),
    artikel.omraader.length ? db.geoTag.findMany({ where: { instansId, navn: { in: artikel.omraader } }, select: { id: true, navn: true } }) : Promise.resolve([]),
  ]);

  const words = artikel.blokke.reduce((n, b) => n + (b.type === "mellemrubrik" ? 0 : countWords(b.tekst)), 0);
  const metaInput = {
    keywords: artikel.tags,
    ogTitel: artikel.seoTitel.slice(0, 95),
    ogBeskrivelse: artikel.seoBeskrivelse.slice(0, 200),
    twitterCard: "summary_large_image",
    twitterTitel: artikel.seoTitel.slice(0, 70),
    twitterBeskrivelse: artikel.seoBeskrivelse.slice(0, 200),
    social: { ...(artikel.opslag.facebook ? { facebook: artikel.opslag.facebook } : {}), ...(artikel.opslag.x ? { x: artikel.opslag.x } : {}) },
    schemaType: profil.schemaType,
    laesetidMin: Math.max(1, Math.round(words / 200)),
    kilder: kilder.filter((k) => artikel.brugteKilder.includes(k.id) || artikel.brugteKilder.length === 0).map((k) => ({
      titel: k.titel.slice(0, 200), ...(k.url ? { url: k.url } : {}), ...(k.udgiver ? { udgiver: k.udgiver } : {}), ...(k.dato ? { dato: k.dato } : {}),
      uddrag: k.tekst.slice(0, 4000), ...(k.type ? { type: k.type } : {}),
    })),
  };
  const meta = (() => {
    for (const candidate of [metaInput, { ...metaInput, social: {} }, { ...metaInput, kilder: metaInput.kilder.map((k) => ({ ...k, url: undefined })) }]) {
      const res = articleMetaSchema.safeParse(candidate);
      if (res.success) return res.data;
    }
    return articleMetaSchema.parse({});
  })();

  const slug = await uniqueSlug(artikel.slug || artikel.titel);
  const blocks = blocksFromGenerated(artikel, kilder);
  const references = Array.from(new Set(kilder.map(referenceFor)));
  try {
    const article = await db.$transaction(async (tx) => {
      const created = await tx.article.create({
        data: {
          titel: artikel.titel.slice(0, 300),
          manchet: artikel.manchet || null,
          slug,
          blocks: blocks as never,
          status: "Idé",
          indholdstype: "AI-assisteret",
          aiBrug: ["Udkast"],
          // godkendtAf udfyldes, når en redaktør godkender og udgiver; uden den kan artiklen ikke udgives.
          marking: { godkendtAf: "", kilder: references, genereret: true } as never,
          seoTitel: artikel.seoTitel || null,
          seoBeskrivelse: artikel.seoBeskrivelse || null,
          kategoriId,
          forfatterId: user.authorId,
          instansId,
          provenance: { via: "artikelgenerator", kørsel: run.id, profil: run.profil, promptVersion: run.promptVersion, billedforslag: artikel.billeder, mangler: artikel.mangler, signalIds: kilder.flatMap((k) => (k.signalId ? [k.signalId] : [])) } as never,
          tags: tagRows.length ? { connect: tagRows.map((t) => ({ id: t.id })) } : undefined,
          geoTags: geoRows.length ? { connect: geoRows.map((g) => ({ id: g.id })) } : undefined,
        },
        select: { id: true },
      });
      await tx.articleMeta.create({ data: { ...(metaToDb(meta) as object), articleId: created.id, instansId } as never });
      await tx.generationRun.update({ where: { id: run.id }, data: { articleId: created.id } });
      const signalIds = kilder.flatMap((k) => (k.signalId ? [k.signalId] : []));
      if (signalIds.length) await tx.signal.updateMany({ where: { id: { in: signalIds }, instansId }, data: { laest: true } });
      await writeAudit(tx, { instansId, actorId: user.id, actorLabel: user.name, action: "engine.generate-draft", targetId: created.id, targetLabel: "Kladde fra artikelgenerator", detail: { kørsel: run.id, profil: run.profil, kilder: kilder.length } });
      return created;
    });
    return { ok: true, articleId: article.id, findesAllerede: false };
  } catch (error) {
    console.error("[generate] kunne ikke oprette kladde", error instanceof Error ? error.message : "ukendt");
    return { ok: false, error: "Kladden kunne ikke oprettes. Prøv igen." };
  }
}
