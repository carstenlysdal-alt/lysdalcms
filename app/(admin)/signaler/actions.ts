"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function markAllRead() {
  const session = await auth();
  if (!session?.user) return;
  await db.signal.updateMany({ where: { instansId: session.user.instansId, laest: false }, data: { laest: true } });
  revalidatePath("/signaler");
}

export async function markRead(id: string) {
  const session = await auth();
  if (!session?.user) return;
  await db.signal.update({ where: { id }, data: { laest: true } });
  revalidatePath("/signaler");
}

export async function createSignal(data: FormData) {
  const session = await auth();
  if (!session?.user) return;
  await db.signal.create({
    data: {
      overskrift: data.get("overskrift") as string,
      brødtekst: (data.get("brødtekst") as string) || null,
      kilde: (data.get("kilde") as string) || "Intern",
      kildeUrl: (data.get("kildeUrl") as string) || null,
      notable: data.get("notable") === "on",
      breaking: data.get("breaking") === "on",
      instansId: session.user.instansId,
    },
  });
  revalidatePath("/signaler");
}
