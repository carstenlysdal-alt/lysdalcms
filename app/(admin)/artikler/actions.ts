"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { blocksSchema } from "@/lib/blocks/schema";
import { db } from "@/lib/db";
import { assertPublishableMarking, CONTENT_TYPES } from "@/lib/marking";
import { can, canEditArticle, PERMISSIONS } from "@/lib/permissions";
import { canTransition, isArticleStatus } from "@/lib/workflow";
import { honorAmountForAssignment } from "@/lib/assignments";

export type ArticleFormState = { error?: string; success?: string; fieldErrors?: Record<string, string[]> };

const articleSchema = z.object({
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

function jsonFromForm(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return null;
  try { return JSON.parse(value) as unknown; } catch { return null; }
}

export async function saveArticle(articleId: string | null, _: ArticleFormState, formData: FormData): Promise<ArticleFormState> {
  const session = await auth();
  if (!session?.user || !can(session.user, PERMISSIONS.ARTICLE_CREATE)) return { error: "Du har ikke adgang til at gemme artikler." };

  const values = articleSchema.safeParse(Object.fromEntries(formData));
  if (!values.success) return { fieldErrors: values.error.flatten().fieldErrors, error: "Kontrollér de markerede felter." };
  const blocks = blocksSchema.safeParse(jsonFromForm(formData.get("blocks")));
  if (!blocks.success) return { error: "En eller flere indholdsblokke er ugyldige. Kontrollér især billed-URL og alt-tekst." };

  const current = articleId ? await db.article.findFirst({ where: { id: articleId, instansId: session.user.instansId } }) : null;
  if (articleId && !current) return { error: "Artiklen findes ikke." };
  if (current && !canEditArticle(session.user, current)) return { error: "Du kan kun redigere dine egne artikler." };

  const requestedStatus = formData.get("targetStatus");
  let nextStatus = current?.status ?? "Idé";
  if (typeof requestedStatus === "string" && requestedStatus) {
    if (!isArticleStatus(requestedStatus) || !current || !canTransition(current.status, requestedStatus, session.user)) {
      return { error: `Overgangen fra ${current?.status ?? "en ny artikel"} til ${requestedStatus} er ikke tilladt.` };
    }
    nextStatus = requestedStatus;
  }

  const aiBrug = formData.getAll("aiBrug").filter((value): value is string => typeof value === "string");
  if (nextStatus === "Publiceret" && aiBrug.length === 0) return { error: "AI-brug skal være registreret før publicering." };
  const marking = values.data.indholdstype === "Partner" || values.data.indholdstype === "Sponsoreret"
    ? { sponsor: String(formData.get("markingSponsor") ?? ""), labelTekst: String(formData.get("markingLabel") ?? ""), aftaleId: String(formData.get("markingAftaleId") ?? "") || undefined }
    : null;
  if (nextStatus === "Publiceret") {
    if (!can(session.user, PERMISSIONS.ARTICLE_PUBLISH)) return { error: "Kun en redaktør med publiceringsret kan publicere." };
    try { assertPublishableMarking(values.data.indholdstype, marking); } catch (error) { return { error: error instanceof Error ? error.message : "Mærkningen er ugyldig." }; }
  }

  const tagIds = formData.getAll("tagIds").filter((v): v is string => typeof v === "string");
  const geoTagIds = formData.getAll("geoTagIds").filter((v): v is string => typeof v === "string");
  const requestedAuthorId = values.data.forfatterId || session.user.authorId;
  const requestedCategoryId = values.data.kategoriId || null;
  const requestedCoverMediaId = values.data.coverMediaId || null;
  const [categoryCount, authorCount, coverCount, tagCount, geoTagCount] = await Promise.all([
    requestedCategoryId ? db.category.count({ where: { id: requestedCategoryId, instansId: session.user.instansId } }) : 1,
    requestedAuthorId ? db.author.count({ where: { id: requestedAuthorId, instansId: session.user.instansId } }) : 1,
    requestedCoverMediaId ? db.media.count({ where: { id: requestedCoverMediaId, instansId: session.user.instansId, filtype: "billede" } }) : 1,
    db.tag.count({ where: { id: { in: tagIds }, instansId: session.user.instansId } }),
    db.geoTag.count({ where: { id: { in: geoTagIds }, instansId: session.user.instansId } }),
  ]);
  if (!categoryCount || !authorCount || !coverCount || tagCount !== new Set(tagIds).size || geoTagCount !== new Set(geoTagIds).size) {
    return { error: "En valgt kategori, forfatter, tag, geografi eller mediefil tilhører ikke denne CMS-instans." };
  }
  const data = {
    ...values.data,
    manchet: values.data.manchet || null,
    kategoriId: requestedCategoryId,
    forfatterId: requestedAuthorId,
    coverMediaId: requestedCoverMediaId,
    seoTitel: values.data.seoTitel || null,
    seoBeskrivelse: values.data.seoBeskrivelse || null,
    blocks: blocks.data as Prisma.InputJsonValue,
    aiBrug: (aiBrug.length ? aiBrug : ["Ingen"]) as Prisma.InputJsonValue,
    marking: marking === null ? Prisma.JsonNull : marking,
    status: nextStatus,
    pinned: formData.get("pinned") === "on",
    breaking: formData.get("breaking") === "on",
    publiceretTid: nextStatus === "Publiceret" ? current?.publiceretTid ?? new Date() : current?.publiceretTid,
    tags: { set: tagIds.map((id) => ({ id })) },
    geoTags: { set: geoTagIds.map((id) => ({ id })) },
  };

  try {
    let article;
    if (current && nextStatus === "Publiceret") {
      article = await db.$transaction(async (tx) => {
        const published = await tx.article.update({ where: { id: current.id }, data });
        const assignment = await tx.assignment.findUnique({ where: { articleId: published.id }, include: { assignedAuthor: { select: { forfatterType: true } } } });
        if (assignment?.assignedAuthorId) {
          await tx.assignment.update({ where: { id: assignment.id }, data: { status: "Godkendt", konfliktGennemgaaet: true } });
          if (assignment.assignedAuthor?.forfatterType === "Freelance") await tx.honorEntry.upsert({
            where: { assignmentId: assignment.id },
            update: {},
            create: {
              beloeb: honorAmountForAssignment(assignment), instansId: session.user.instansId,
              assignmentId: assignment.id, authorId: assignment.assignedAuthorId, articleId: published.id,
            },
          });
        }
        await tx.articleRevision.create({
          data: { articleId: published.id, userId: session.user.id, snapshot: JSON.parse(JSON.stringify(published)) as Prisma.InputJsonValue, note: "Publiceret" },
        });
        return published;
      });
    } else if (current) {
      article = await db.article.update({ where: { id: current.id }, data });
    } else {
      const { tags: relationTags, geoTags: relationGeoTags, ...createData } = data;
      void relationTags;
      void relationGeoTags;
      article = await db.article.create({ data: {
        ...createData,
        instansId: session.user.instansId,
        tags: { connect: tagIds.map((id) => ({ id })) },
        geoTags: { connect: geoTagIds.map((id) => ({ id })) },
      } });
    }
    revalidatePath("/artikler");
    revalidatePath(`/artikler/${article.id}`);
    if (!current) redirect(`/artikler/${article.id}?created=1`);
    return { success: nextStatus === "Publiceret" ? "Artiklen er publiceret." : "Ændringerne er gemt." };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return { error: "Sluggen bruges allerede af en anden artikel." };
    throw error;
  }
}

export async function toggleArticleFlag(articleId: string, flag: "pinned" | "breaking") {
  const session = await auth();
  if (!session?.user || !can(session.user, PERMISSIONS.FRONTPAGE_EDIT)) throw new Error("Ingen adgang til forsidestyring.");
  const article = await db.article.findFirst({ where: { id: articleId, instansId: session.user.instansId }, select: { pinned: true, breaking: true } });
  if (!article) throw new Error("Artiklen findes ikke.");
  await db.article.update({ where: { id: articleId }, data: { [flag]: !article[flag] } });
  revalidatePath("/artikler");
}
