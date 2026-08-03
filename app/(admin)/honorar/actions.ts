"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can, PERMISSIONS } from "@/lib/permissions";

export async function approveHonor(id: string) {
  const session = await auth();
  if (!session?.user || !can(session.user, PERMISSIONS.HONOR_MANAGE)) throw new Error("Du har ikke adgang til at godkende honorarer.");
  const result = await db.honorEntry.updateMany({
    where: { id, instansId: session.user.instansId, status: "Afventer" },
    data: { status: "Godkendt", approvedAt: new Date(), approvedById: session.user.id },
  });
  if (result.count !== 1) throw new Error("Honoraret findes ikke eller er allerede behandlet.");
  revalidatePath("/honorar");
}
