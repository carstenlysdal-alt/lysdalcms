/**
 * Fælles gem-logik for artikler: validering (marking, AI-brug, kategorispærring, workflow, tenant-tjek) og skrivning.
 *
 * Bruges af
 *  - `saveArticle` (formular: Gem/Opdater/Publicér — `mode: "full"`),
 *  - `saveDraftAction` (autosave — `mode: "draft"`: aldrig statusskift/publicering/revision),
 *  - service-funktionerne i lib/article-service.ts (AI-operatøren m.fl.).
 *
 * Reglerne er uændret flyttet hertil fra app/redaktion/artikler/actions.ts; draft-mode springer kun statusskift og
 * publiceringskrav over — den omgår ALDRIG mærkning, AI-brugsregler, Krimi/Sundhed-spærring eller tenant-tjek.
 */
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { AuthorizedUser } from "@/lib/auth";
import { blocksSchema } from "@/lib/blocks/schema";
import { db } from "@/lib/db";
import { loadCategoryTree } from "@/lib/category-tree";
import { AI_TEXT_GENERATING_USES, AI_USE_NONE, assertPublishableMarking, CONTENT_TYPES, isAiRestrictedCategoryTree, normalizeAiUse } from "@/lib/marking";
import { can, canEditArticle, PERMISSIONS } from "@/lib/permissions";
import { canTransition, isArticleStatus } from "@/lib/workflow";
import { honorAmountForAssignment } from "@/lib/assignments";
import { purgeInstance } from "@/lib/cache/purge";
import { isDefaultMeta, metaToDb, type ArticleMetaValue } from "@/lib/article-meta";
import { recordSlugRedirect, sectionSlugOf } from "@/lib/slug-redirect";
import { slugify } from "@/lib/slug";
import { queuePublishedRevision } from "@/lib/knowledge/publication-outbox";

export type ArticleSaveInput = {
  titel: string;
  manchet?: string;
  /** Tom = generér fra titlen (unik). */
  slug?: string;
  /** Sluggen er automatisk afledt af titlen: ved konflikt gives den et unikt suffix (-2, -3 …) i stedet for en fejl. */
  slugAuto?: boolean;
  indholdstype: string;
  kategoriId?: string;
  forfatterId?: string;
  coverMediaId?: string;
  seoTitel?: string;
  seoBeskrivelse?: string;
  sprog: string;
  /** Allerede JSON-parset (blocksSchema valideres her). */
  blocks: unknown;
  aiBrug: string[];
  marking: { sponsor?: string; label?: string; aftaleId?: string; afsender?: string; kilder?: string; kildeVerificeret?: boolean };
  pinned?: boolean;
  breaking?: boolean;
  tagIds: string[];
  geoTagIds: string[];
  /** undefined = uændret; null = ryd. */
  planlagtTid?: Date | null;
  /** undefined = uændret. */
  meta?: ArticleMetaValue;
};

export type SaveMode = "draft" | "full";

export type PrepareOptions = {
  mode: SaveMode;
  /** Kun i full-mode: ønsket statusskift. */
  targetStatus?: string | null;
  /** ms-version (opdateretTid) klienten har set; afviger den => konflikt. */
  baseVersion?: number | null;
};

export type SaveFailure = { ok: false; error: string; fieldErrors?: Record<string, string[]>; conflict?: boolean };

export const articleSchema = z.object({
  titel: z.string().trim().min(3, "Titlen skal være mindst 3 tegn."),
  manchet: z.string().trim().optional(),
  slug: z.string().trim().min(3).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Brug små bogstaver, tal og bindestreger."),
  indholdstype: z.enum(CONTENT_TYPES),
  kategoriId: z.string().optional(),
  forfatterId: z.string().optional(),
  coverMediaId: z.string().optional(),
  seoTitel: z.string().trim().optional(),
  seoBeskrivelse: z.string().trim().optional(),
  sprog: z.string().trim().min(2),
});

/** Status hvor artiklen vises offentligt. Autosave skriver aldrig til en live artikel. */
export const LIVE_STATUS = "Publiceret";

/** Unik slug ud fra en tekst (`-2`, `-3` … ved konflikt). `excludeId` = artiklen selv. Slug er globalt unik i skemaet. */
export async function ensureUniqueSlug(text: string, excludeId?: string | null): Promise<string> {
  const base = slugify(text, 80) || "artikel";
  for (let n = 1; n < 200; n++) {
    const candidate = n === 1 ? base : `${base.slice(0, 76)}-${n}`;
    const hit = await db.article.findFirst({ where: { slug: candidate, ...(excludeId ? { id: { not: excludeId } } : {}) }, select: { id: true } });
    if (!hit) return candidate;
  }
  return `${base.slice(0, 60)}-${Date.now().toString(36)}`;
}

type CurrentArticle = NonNullable<Awaited<ReturnType<typeof loadCurrent>>>;

async function loadCurrent(instansId: string, articleId: string) {
  return db.article.findFirst({
    where: { id: articleId, instansId },
    include: { tags: { select: { id: true } }, geoTags: { select: { id: true } }, meta: true, kategori: { include: { parent: true } } },
  });
}

export type Prepared = {
  ok: true;
  user: AuthorizedUser;
  mode: SaveMode;
  current: CurrentArticle | null;
  nextStatus: string;
  data: Prisma.ArticleUpdateInput & Record<string, unknown>;
  scalar: Record<string, unknown>;
  tagIds: string[];
  geoTagIds: string[];
  meta?: ArticleMetaValue;
  newSection: string;
  warnings: string[];
};

export async function prepareArticleSave(user: AuthorizedUser, articleId: string | null, input: ArticleSaveInput, opts: PrepareOptions): Promise<Prepared | SaveFailure> {
  if (!can(user, PERMISSIONS.ARTICLE_CREATE)) return { ok: false, error: "Du har ikke adgang til at gemme artikler." };
  const draft = opts.mode === "draft";

  const slugInput = input.slug?.trim() ? input.slug : "";
  const values = articleSchema.safeParse({ ...input, slug: slugInput || "auto" });
  // "auto" er kun en pladsholder så øvrige felter valideres; ægte slug genereres nedenfor.
  if (!values.success) return { ok: false, fieldErrors: values.error.flatten().fieldErrors, error: "Kontrollér de markerede felter." };
  const blocks = blocksSchema.safeParse(input.blocks);
  if (!blocks.success) return { ok: false, error: "En eller flere indholdsblokke er ugyldige. Kontrollér især billed-URL og alt-tekst." };

  const current = articleId ? await loadCurrent(user.instansId, articleId) : null;
  if (articleId && !current) return { ok: false, error: "Artiklen findes ikke." };
  if (current && !canEditArticle(user, current)) return { ok: false, error: "Du kan kun redigere dine egne artikler." };

  if (draft && current) {
    if (current.status === LIVE_STATUS) return { ok: false, error: "Publicerede artikler gemmes kun med Opdater artikel (ingen automatisk gem)." };
    if (typeof opts.baseVersion === "number" && opts.baseVersion !== current.opdateretTid.getTime()) {
      return { ok: false, conflict: true, error: "Artiklen er ændret et andet sted (en anden bruger eller et andet vindue) siden du åbnede den. Genindlæs siden for at se den seneste version, før du fortsætter." };
    }
  } else if (!draft && current && typeof opts.baseVersion === "number" && opts.baseVersion !== current.opdateretTid.getTime()) {
    return { ok: false, conflict: true, error: "Artiklen er ændret et andet sted siden du åbnede den. Genindlæs siden for at se den seneste version, før du gemmer." };
  }

  const canControlFrontpage = can(user, PERMISSIONS.FRONTPAGE_EDIT);
  const requestedStatus = draft ? null : opts.targetStatus;
  let nextStatus = current?.status ?? "Idé";
  if (typeof requestedStatus === "string" && requestedStatus) {
    if (!isArticleStatus(requestedStatus) || !current || !canTransition(current.status, requestedStatus, user)) {
      return { ok: false, error: `Overgangen fra ${current?.status ?? "en ny artikel"} til ${requestedStatus} er ikke tilladt.` };
    }
    nextStatus = requestedStatus;
    // Planlagt udgivelse sættes kun af en bruger med publiceringsret (cron publicerer senere på redaktørens vegne).
    if (nextStatus === "Planlagt" && !can(user, PERMISSIONS.ARTICLE_PUBLISH)) {
      return { ok: false, error: "Kun en redaktør med publiceringsret kan planlægge en udgivelse." };
    }
  }

  // AI-brug: aktivt valg ("Ingen AI brugt" ELLER konkret brug). Uden valg gemmes en tom liste (ikke taget stilling),
  // som ikke kan publiceres — så en artikel uden AI ikke tvinges til en falsk afkrydsning.
  const aiUse = normalizeAiUse(input.aiBrug, { requireChoice: nextStatus === "Publiceret" });
  if (!aiUse.ok) return { ok: false, error: aiUse.error };
  const aiBrug = aiUse.value;
  const currentMarking = current?.marking && typeof current.marking === "object" && !Array.isArray(current.marking) ? (current.marking as Record<string, unknown>) : {};
  let marking: unknown = null;
  const m = input.marking;
  if (values.data.indholdstype === "Partner") {
    marking = { sponsor: String(m.sponsor ?? ""), labelTekst: String(m.label ?? ""), aftaleId: String(m.aftaleId ?? "") };
  } else if (values.data.indholdstype === "Sponsoreret") {
    marking = { sponsor: String(m.sponsor ?? ""), labelTekst: String(m.label ?? "") };
  } else if (values.data.indholdstype === "Brugerindsendt" || values.data.indholdstype === "PR") {
    marking = { afsender: String(m.afsender ?? "") };
  } else if (values.data.indholdstype === "AI-assisteret") {
    // "Godkendt af" er IKKE fri tekst: ved publicering sættes den til den godkendende (publicerende) bruger, slået op i
    // databasen. Indtil da bevares evt. tidligere værdi; et felt i formularen ignoreres (kan ikke forfalske en godkender).
    // Planlægges artiklen, er den planlæggende redaktør godkenderen (cron publicerer uden bruger).
    const approved = nextStatus === "Publiceret" || (nextStatus === "Planlagt" && current?.status !== "Planlagt");
    marking = {
      godkendtAf: approved ? user.name : typeof currentMarking.godkendtAf === "string" ? currentMarking.godkendtAf : "",
      ...(approved ? { godkendtAfUserId: user.id } : typeof currentMarking.godkendtAfUserId === "string" ? { godkendtAfUserId: currentMarking.godkendtAfUserId } : {}),
      kilder: String(m.kilder ?? "").split("\n").map((s) => s.trim()).filter(Boolean),
      ...(currentMarking.maskinleveret === true ? { maskinleveret: true } : {}),
    };
  }

  // Kildeverifikation (T6 nr. 25): kladder fra Q&A/interview/meddeler bærer `uverificeretKilde`. Flaget bevares gennem gem
  // og fjernes kun når redaktøren afkrydser, at kildens identitet er verificeret; publicering kræver at det er fjernet.
  if (typeof currentMarking.uverificeretKilde === "boolean") {
    const verified = m.kildeVerificeret === true;
    const carried: Record<string, unknown> = { type: currentMarking.type, uverificeretKilde: !verified };
    marking = marking && typeof marking === "object" ? { ...(marking as Record<string, unknown>), ...carried } : carried;
  }

  if (values.data.indholdstype === "AI-assisteret" && aiBrug.length === 1 && aiBrug[0] === AI_USE_NONE) {
    return { ok: false, error: "Et AI-assisteret indhold kan ikke registreres med 'Ingen AI brugt'. Vælg den faktiske AI-brug eller skift indholdstype." };
  }

  if (values.data.indholdstype === "AI-assisteret") {
    for (const b of blocks.data) {
      if (b.type === "quote") {
        const qData = b.data as { quote: string; attribution?: string; kildeUrl?: string; dato?: string };
        if (!qData.kildeUrl || !qData.dato) {
          return { ok: false, error: "Citater i AI-assisterede artikler kræver kilde-URL/reference og dato." };
        }
      }
    }
  }

  if (nextStatus === "Publiceret") {
    if (!can(user, PERMISSIONS.ARTICLE_PUBLISH)) return { ok: false, error: "Kun en redaktør med publiceringsret kan publicere." };
    if (marking && typeof marking === "object" && (marking as { uverificeretKilde?: unknown }).uverificeretKilde === true) {
      return { ok: false, error: "Kildens identitet er ikke verificeret. Afkryds 'Kildens identitet er verificeret' (i sidebjælken), når redaktionen har kontrolleret kilden." };
    }
    try { assertPublishableMarking(values.data.indholdstype, marking); } catch (error) { return { ok: false, error: error instanceof Error ? error.message : "Mærkningen er ugyldig." }; }
  }

  const tagIds = input.tagIds;
  const geoTagIds = input.geoTagIds;
  const requestedAuthorId = values.data.forfatterId || user.authorId;
  const requestedCategoryId = values.data.kategoriId || null;

  // AI-spærring (T5 P2-7): afgøres på kategoriens id og HELE forældrekæden (slug/navn), uafhængigt af indholdstype.
  // Udkast/omskrivning med AI er forbudt i Krimi og retsvæsen/Sundhed, også for "Uafhængig" artikler.
  let newSection = sectionSlugOf(current?.kategori);
  if (requestedCategoryId) {
    const tree = await loadCategoryTree(user.instansId, requestedCategoryId);
    if (tree) newSection = sectionSlugOf(tree as { slug: string; parent?: { slug: string } | null });
    if (tree && isAiRestrictedCategoryTree(tree)) {
      if (values.data.indholdstype === "AI-assisteret") {
        return { ok: false, error: "Artikler i kategorierne Krimi og retsvæsen samt Sundhed må ikke være AI-assisterede uden journalistisk gennemskrivning." };
      }
      if (aiBrug.some((use) => AI_TEXT_GENERATING_USES.includes(use))) {
        return { ok: false, error: "AI-brug til udkast eller omskrivning er ikke tilladt i Krimi og retsvæsen samt Sundhed." };
      }
    }
  } else {
    newSection = "nyheder";
  }

  const requestedCoverMediaId = values.data.coverMediaId || null;
  const meta = input.meta;
  const metaMediaIds = [meta?.ogMediaId, meta?.twitterMediaId].filter((v): v is string => Boolean(v));
  const creditAuthorIds = (meta?.medforfattere ?? []).map((c) => c.authorId).filter((v): v is string => Boolean(v));
  const [categoryCount, authorCount, coverCount, tagCount, geoTagCount, metaMediaCount, creditAuthorCount] = await Promise.all([
    requestedCategoryId ? db.category.count({ where: { id: requestedCategoryId, instansId: user.instansId } }) : 1,
    requestedAuthorId ? db.author.count({ where: { id: requestedAuthorId, instansId: user.instansId } }) : 1,
    requestedCoverMediaId ? db.media.count({ where: { id: requestedCoverMediaId, instansId: user.instansId, filtype: "billede" } }) : 1,
    db.tag.count({ where: { id: { in: tagIds }, instansId: user.instansId } }),
    db.geoTag.count({ where: { id: { in: geoTagIds }, instansId: user.instansId } }),
    metaMediaIds.length ? db.media.count({ where: { id: { in: [...new Set(metaMediaIds)] }, instansId: user.instansId, filtype: "billede" } }) : 0,
    creditAuthorIds.length ? db.author.count({ where: { id: { in: [...new Set(creditAuthorIds)] }, instansId: user.instansId } }) : 0,
  ]);
  if (!categoryCount || !authorCount || !coverCount || tagCount !== new Set(tagIds).size || geoTagCount !== new Set(geoTagIds).size) {
    return { ok: false, error: "En valgt kategori, forfatter, tag, geografi eller mediefil tilhører ikke denne CMS-instans." };
  }
  if (metaMediaCount !== new Set(metaMediaIds).size || creditAuthorCount !== new Set(creditAuthorIds).size) {
    return { ok: false, error: "Et valgt delingsbillede eller en medforfatter tilhører ikke denne CMS-instans." };
  }

  // Planlægning: status "Planlagt" kræver et fremtidigt udgivelsestidspunkt (ellers ville cron publicere med det samme).
  const planlagtTid = input.planlagtTid === undefined ? current?.planlagtTid ?? null : input.planlagtTid;
  if (!draft && nextStatus === "Planlagt" && current?.status !== "Planlagt") {
    if (!planlagtTid) return { ok: false, error: "Angiv et udgivelsestidspunkt, før artiklen kan sættes til Planlagt." };
    if (planlagtTid.getTime() < Date.now() - 60_000) return { ok: false, error: "Udgivelsestidspunktet ligger i fortiden." };
  }

  // Slug: tom => genereres unikt fra titlen. Slug skiftes aldrig stille på en live artikel uden at omdirigeringen oprettes (persist).
  let slug = slugInput || (current?.slug ?? await ensureUniqueSlug(values.data.titel, current?.id));
  if (slugInput && input.slugAuto && slugInput !== current?.slug) {
    const taken = await db.article.findFirst({ where: { slug: slugInput, ...(current ? { id: { not: current.id } } : {}) }, select: { id: true } });
    if (taken) slug = await ensureUniqueSlug(slugInput, current?.id);
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length < 3) return { ok: false, fieldErrors: { slug: ["Brug små bogstaver, tal og bindestreger (mindst 3 tegn)."] }, error: "Kontrollér de markerede felter." };

  const { slug: _slug, ...rest } = values.data;
  void _slug;
  const scalar: Record<string, unknown> = {
    ...rest,
    slug,
    manchet: values.data.manchet || null,
    kategoriId: requestedCategoryId,
    forfatterId: requestedAuthorId,
    coverMediaId: requestedCoverMediaId,
    seoTitel: values.data.seoTitel || null,
    seoBeskrivelse: values.data.seoBeskrivelse || null,
    blocks: blocks.data as Prisma.InputJsonValue,
    aiBrug: aiBrug as Prisma.InputJsonValue,
    marking: marking === null ? Prisma.JsonNull : marking,
    status: nextStatus,
    // Forsidestyring (T5 P2-4): kun FRONTPAGE_EDIT må sætte "fastgjort"/"breaking". Andre bevarer den eksisterende værdi
    // (false ved ny artikel), så en forfatter ikke kan skubbe sin artikel i hero uden forsideredaktørens beslutning.
    pinned: canControlFrontpage ? input.pinned === true : current?.pinned ?? false,
    breaking: canControlFrontpage ? input.breaking === true : current?.breaking ?? false,
    publiceretTid: nextStatus === "Publiceret" ? current?.publiceretTid ?? new Date() : current?.publiceretTid,
    planlagtTid,
  };
  // Sidste substantielle opdatering: bevares fra metadata (redaktørens valg), ellers uændret.
  return {
    ok: true,
    user,
    mode: opts.mode,
    current,
    nextStatus,
    data: scalar as Prisma.ArticleUpdateInput & Record<string, unknown>,
    scalar,
    tagIds,
    geoTagIds,
    meta,
    newSection,
    warnings: [],
  };
}

/** Skriver en forberedt artikel (inkl. metadata, slug-redirect, publiceringsbivirkninger). Kaster kun uventede fejl. */
export async function persistArticleSave(p: Prepared): Promise<{ ok: true; article: { id: string; slug: string; opdateretTid: Date; status: string }; created: boolean } | SaveFailure> {
  const { user, current, nextStatus, scalar, tagIds, geoTagIds, meta } = p;
  const draft = p.mode === "draft";
  const updateData = { ...scalar, tags: { set: tagIds.map((id) => ({ id })) }, geoTags: { set: geoTagIds.map((id) => ({ id })) } } as Prisma.ArticleUpdateInput;

  const writeMeta = async (tx: Prisma.TransactionClient, articleId: string) => {
    if (!meta) return;
    if (!current?.meta && isDefaultMeta(meta)) return; // ingen tom række
    const db_ = metaToDb(meta);
    await tx.articleMeta.upsert({
      where: { articleId },
      update: db_ as Prisma.ArticleMetaUncheckedUpdateInput,
      create: { ...(db_ as object), articleId, instansId: user.instansId } as Prisma.ArticleMetaUncheckedCreateInput,
    });
  };

  try {
    let article: { id: string; slug: string; opdateretTid: Date; status: string };
    let created = false;
    if (current) {
      article = await db.$transaction(async (tx) => {
        const updated = await tx.article.update({ where: { id: current.id }, data: updateData });
        await writeMeta(tx, updated.id);
        // Slug-/sektionsskift på en LIVE artikel => omdirigering fra den gamle URL.
        if (current.status === LIVE_STATUS && updated.status === LIVE_STATUS) {
          await recordSlugRedirect(tx, {
            instansId: user.instansId,
            articleId: updated.id,
            from: { sektion: sectionSlugOf(current.kategori), slug: current.slug },
            to: { sektion: p.newSection, slug: updated.slug },
          });
        }
        if (!draft && nextStatus === "Publiceret") {
          await completeAssignmentOnPublish(tx, updated, user.instansId);
          const revision = await tx.articleRevision.create({
            data: { articleId: updated.id, userId: user.id, snapshot: JSON.parse(JSON.stringify(updated)) as Prisma.InputJsonValue, note: "Publiceret" },
          });
          await queuePublishedRevision(tx, revision.id);
        } else if (!draft && current.status !== nextStatus) {
          // Statusskift gemmes altid som revision (hvem, hvornår, fra/til) — også andre end publicering.
          await tx.articleRevision.create({
            data: { articleId: updated.id, userId: user.id, snapshot: JSON.parse(JSON.stringify(updated)) as Prisma.InputJsonValue, note: `Status: ${current.status} → ${nextStatus}` },
          });
        }
        return updated;
      });
    } else {
      const { tags: _t, geoTags: _g, ...createData } = updateData as Record<string, unknown>;
      void _t; void _g;
      article = await db.$transaction(async (tx) => {
        const createdRow = await tx.article.create({
          data: {
            ...(createData as object),
            instansId: user.instansId,
            tags: { connect: tagIds.map((id) => ({ id })) },
            geoTags: { connect: geoTagIds.map((id) => ({ id })) },
          } as Prisma.ArticleUncheckedCreateInput,
        });
        await writeMeta(tx, createdRow.id);
        return createdRow;
      });
      created = true;
    }
    revalidatePath("/redaktion/artikler");
    revalidatePath(`/redaktion/artikler/${article.id}`);
    if (!draft) revalidatePath("/");
    if (!draft && (nextStatus === "Publiceret" || current?.status === "Publiceret")) {
      const purgePaths = [`/${article.slug}`];
      if (current && current.slug !== article.slug) purgePaths.push(`/${current.slug}`);
      void purgeInstance(user.instansId, purgePaths); // CDN-purge (no-op uden CF_API_TOKEN)
    }
    return { ok: true, article, created };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return { ok: false, error: "Sluggen bruges allerede af en anden artikel." };
    throw error;
  }
}

/** Opgave + honorar ved publicering (uændret fra saveArticle; delt med cron-publicering). */
export async function completeAssignmentOnPublish(tx: Prisma.TransactionClient, published: { id: string }, instansId: string) {
  const assignment = await tx.assignment.findUnique({ where: { articleId: published.id }, include: { assignedAuthor: { select: { forfatterType: true } } } });
  if (assignment?.assignedAuthorId) {
    await tx.assignment.update({ where: { id: assignment.id }, data: { status: "Godkendt", konfliktGennemgaaet: true } });
    if (assignment.assignedAuthor?.forfatterType === "Freelance") await tx.honorEntry.upsert({
      where: { assignmentId: assignment.id },
      update: {},
      create: {
        beloeb: honorAmountForAssignment(assignment), instansId,
        assignmentId: assignment.id, authorId: assignment.assignedAuthorId, articleId: published.id,
      },
    });
  }
}

/** Udtræk det gemmes-input fra en eksisterende artikel (til delvise rettelser fra service-laget). */
export function inputFromArticle(row: CurrentArticle): ArticleSaveInput {
  const marking = row.marking && typeof row.marking === "object" && !Array.isArray(row.marking) ? (row.marking as Record<string, unknown>) : {};
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  return {
    titel: row.titel,
    manchet: row.manchet ?? "",
    slug: row.slug,
    indholdstype: row.indholdstype,
    kategoriId: row.kategoriId ?? "",
    forfatterId: row.forfatterId ?? "",
    coverMediaId: row.coverMediaId ?? "",
    seoTitel: row.seoTitel ?? "",
    seoBeskrivelse: row.seoBeskrivelse ?? "",
    sprog: row.sprog,
    blocks: row.blocks,
    aiBrug: Array.isArray(row.aiBrug) ? row.aiBrug.filter((v): v is string => typeof v === "string") : [],
    marking: {
      sponsor: str(marking.sponsor),
      label: str(marking.labelTekst),
      aftaleId: str(marking.aftaleId),
      afsender: str(marking.afsender),
      kilder: Array.isArray(marking.kilder) ? (marking.kilder as unknown[]).filter((k): k is string => typeof k === "string").join("\n") : "",
      kildeVerificeret: marking.uverificeretKilde === false,
    },
    pinned: row.pinned,
    breaking: row.breaking,
    tagIds: row.tags.map((t) => t.id),
    geoTagIds: row.geoTags.map((t) => t.id),
    planlagtTid: row.planlagtTid,
  };
}

export { loadCurrent as loadArticleForSave };
