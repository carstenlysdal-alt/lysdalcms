"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { assignmentSchema, canTransitionAssignment, parseLocalDateTime } from "@/lib/assignments";
import { db } from "@/lib/db";
import { can, PERMISSIONS } from "@/lib/permissions";

export type AssignmentFormState = { error?: string; success?: string; fieldErrors?: Record<string, string[]> };

async function validateRelations(instansId: string, values: { assignedAuthorId?: string; articleId?: string; supportAgreementId?: string }) {
  const [author, article, agreement] = await Promise.all([
    values.assignedAuthorId ? db.author.count({ where: { id: values.assignedAuthorId, instansId } }) : 1,
    values.articleId ? db.article.count({ where: { id: values.articleId, instansId } }) : 1,
    values.supportAgreementId ? db.supportAgreement.count({ where: { id: values.supportAgreementId, instansId } }) : 1,
  ]);
  return Boolean(author && article && agreement);
}

export async function saveAssignment(id: string | null, _: AssignmentFormState, formData: FormData): Promise<AssignmentFormState> {
  const session = await auth();
  if (!session?.user?.id || !can(session.user, PERMISSIONS.TASK_MANAGE)) return { error: "Du har ikke adgang til at administrere opgaver." };
  const parsed = assignmentSchema.safeParse({ ...Object.fromEntries(formData), iPulje: formData.get("iPulje") === "on" });
  if (!parsed.success) return { error: "Kontrollér opgavens felter.", fieldErrors: parsed.error.flatten().fieldErrors };
  const deadline = parseLocalDateTime(parsed.data.afleveringsDeadline);
  const researchDeadline = parseLocalDateTime(parsed.data.researchDeadline);
  if (!deadline) return { error: "Afleveringsdeadlinen er ugyldig." };
  if (researchDeadline && researchDeadline > deadline) return { error: "Researchdeadlinen skal ligge før afleveringsdeadlinen." };
  const existing = id ? await db.assignment.findFirst({ where: { id, instansId: session.user.instansId } }) : null;
  if (id && !existing) return { error: "Opgaven findes ikke." };
  if (!(await validateRelations(session.user.instansId, parsed.data))) return { error: "En valgt relation tilhører ikke denne CMS-instans." };
  if (parsed.data.iPulje && parsed.data.assignedAuthorId) return { error: "En puljeopgave kan ikke samtidig være direkte tildelt." };
  const assignedAuthorId = parsed.data.iPulje ? null : parsed.data.assignedAuthorId || null;
  const baseData = {
    titel: parsed.data.titel, beskrivelse: parsed.data.beskrivelse, leverancetype: parsed.data.leverancetype,
    researchDeadline, afleveringsDeadline: deadline, estimeretHonorar: parsed.data.estimeretHonorar,
    assignedAuthorId, articleId: parsed.data.articleId || null, supportAgreementId: parsed.data.supportAgreementId || null,
    iPulje: parsed.data.iPulje,
  };
  try {
    const updatedStatus = existing && !["Godkendt", "Annulleret"].includes(existing.status)
      ? (parsed.data.iPulje || !assignedAuthorId ? "Åben" : existing.status === "Åben" ? "Tildelt" : existing.status)
      : existing?.status;
    const assignment = existing
      ? await db.assignment.update({ where: { id: existing.id }, data: { ...baseData, status: updatedStatus } })
      : await db.assignment.create({ data: { ...baseData, status: assignedAuthorId ? "Tildelt" : "Åben", instansId: session.user.instansId, createdById: session.user.id } });
    revalidatePath("/opgaver");
    if (!existing) redirect(`/opgaver/${assignment.id}?created=1`);
    return { success: "Opgaven er gemt." };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return { error: "Artiklen er allerede koblet til en anden opgave." };
    throw error;
  }
}

export async function claimAssignment(id: string) {
  const session = await auth();
  if (!session?.user?.authorId || !can(session.user, PERMISSIONS.ARTICLE_CREATE)) throw new Error("Du kan ikke tage denne opgave.");
  const result = await db.assignment.updateMany({
    where: { id, instansId: session.user.instansId, iPulje: true, status: "Åben", assignedAuthorId: null },
    data: { assignedAuthorId: session.user.authorId, iPulje: false, status: "Tildelt" },
  });
  if (result.count !== 1) throw new Error("Opgaven er allerede taget eller ikke længere åben.");
  revalidatePath("/opgaver");
  revalidatePath(`/opgaver/${id}`);
}

export async function transitionAssignment(id: string, targetStatus: string, formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Ikke logget ind.");
  const assignment = await db.assignment.findFirst({ where: { id, instansId: session.user.instansId } });
  if (!assignment) throw new Error("Opgaven findes ikke.");
  const isManager = can(session.user, PERMISSIONS.TASK_MANAGE);
  const isAssigned = Boolean(session.user.authorId && assignment.assignedAuthorId === session.user.authorId);
  const role = isManager ? "manager" : "assigned";
  if ((!isManager && !isAssigned) || !canTransitionAssignment(assignment.status, targetStatus, role)) throw new Error("Statusovergangen er ikke tilladt.");
  const conflict = String(formData.get("interessekonflikt") ?? "").trim();
  if (targetStatus === "Afleveret" && !conflict) throw new Error("Erklær interessekonflikt eller skriv 'Ingen' før aflevering.");
  await db.assignment.update({ where: { id: assignment.id }, data: {
    status: targetStatus,
    ...(targetStatus === "Afleveret" ? { interessekonflikt: conflict, konfliktGennemgaaet: false } : {}),
    ...(targetStatus === "Godkendt" ? { konfliktGennemgaaet: true } : {}),
  } });
  revalidatePath("/opgaver");
  revalidatePath(`/opgaver/${id}`);
}
