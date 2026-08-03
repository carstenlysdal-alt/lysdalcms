"use server";

import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ALLOWED_UPLOADS, MAX_UPLOAD_BYTES, mediaMetadataSchema, parseRightsExpiry, validateRequiredImageMetadata } from "@/lib/media";
import { optimizeImage } from "@/lib/media-storage";
import { can, PERMISSIONS } from "@/lib/permissions";

export type MediaFormState = { error?: string; success?: string; fieldErrors?: Record<string, string[]> };

const externalSchema = z.string().url("Angiv en gyldig URL med http eller https.");

function metadataFrom(formData: FormData, forcedType?: string) {
  return mediaMetadataSchema.safeParse({
    filtype: forcedType ?? formData.get("filtype"),
    altTekst: formData.get("altTekst") || undefined,
    billedtekst: formData.get("billedtekst") || undefined,
    ophavsperson: formData.get("ophavsperson") || undefined,
    rettighedsstatus: formData.get("rettighedsstatus") || undefined,
    licensType: formData.get("licensType") || undefined,
    rettighedsUdlob: formData.get("rettighedsUdlob") || undefined,
  });
}

async function requireMediaManager() {
  const session = await auth();
  if (!session?.user || !can(session.user, PERMISSIONS.MEDIA_MANAGE)) return null;
  return session.user;
}

export async function createMedia(_: MediaFormState, formData: FormData): Promise<MediaFormState> {
  const user = await requireMediaManager();
  if (!user) return { error: "Du har ikke adgang til at tilføje medier." };
  const source = formData.get("source");
  let url: string;
  let filnavn: string | null = null;
  let mimeType: string | null = null;
  let stoerrelse: number | null = null;
  let bredde: number | null = null;
  let hoejde: number | null = null;
  let kildeType = "Ekstern";
  let forcedType: string | undefined;

  if (source === "upload") {
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) return { error: "Vælg en fil, der skal uploades." };
    if (file.size > MAX_UPLOAD_BYTES) return { error: "Filen må højst fylde 10 MB." };
    const allowed = ALLOWED_UPLOADS[file.type];
    if (!allowed) return { error: "Filtypen understøttes ikke. Brug JPG, PNG, WebP, MP4, WebM, MP3, WAV, OGG eller PDF." };
    const earlyMetadata = metadataFrom(formData, allowed.type);
    if (!earlyMetadata.success) return { error: "Kontrollér mediets metadata.", fieldErrors: earlyMetadata.error.flatten().fieldErrors };
    const earlyImageError = validateRequiredImageMetadata(allowed.type, earlyMetadata.data);
    if (earlyImageError) return { error: earlyImageError };
    const input = Buffer.from(await file.arrayBuffer());
    const id = randomUUID();
    const uploadRoot = path.resolve(process.cwd(), "public", "uploads");
    await mkdir(uploadRoot, { recursive: true });
    if (allowed.type === "billede") {
      try {
        const optimized = await optimizeImage(input);
        await writeFile(path.join(uploadRoot, `${id}.webp`), optimized.data, { flag: "wx" });
        url = `/uploads/${id}.webp`;
        mimeType = optimized.mimeType;
        stoerrelse = optimized.size;
        bredde = optimized.width;
        hoejde = optimized.height;
      } catch {
        return { error: "Billedfilen kunne ikke valideres eller optimeres." };
      }
    } else {
      const storedName = `${id}.${allowed.extension}`;
      await writeFile(path.join(uploadRoot, storedName), input, { flag: "wx" });
      url = `/uploads/${storedName}`;
      mimeType = file.type;
      stoerrelse = file.size;
    }
    filnavn = file.name.slice(0, 240);
    forcedType = allowed.type;
    kildeType = "Lokal";
  } else {
    const parsedUrl = externalSchema.safeParse(formData.get("url"));
    if (!parsedUrl.success) return { error: parsedUrl.error.issues[0]?.message };
    url = parsedUrl.data;
    filnavn = url.split("/").pop()?.slice(0, 240) || null;
  }

  const metadata = metadataFrom(formData, forcedType);
  if (!metadata.success) return { error: "Kontrollér mediets metadata.", fieldErrors: metadata.error.flatten().fieldErrors };
  const imageError = validateRequiredImageMetadata(metadata.data.filtype, metadata.data);
  if (imageError) return { error: imageError };
  const media = await db.media.create({ data: {
    ...metadata.data,
    altTekst: metadata.data.altTekst || null,
    billedtekst: metadata.data.billedtekst || null,
    ophavsperson: metadata.data.ophavsperson || null,
    rettighedsstatus: metadata.data.rettighedsstatus || null,
    licensType: metadata.data.licensType || null,
    rettighedsUdlob: parseRightsExpiry(metadata.data.rettighedsUdlob),
    url, filnavn, mimeType, stoerrelse, bredde, hoejde, kildeType,
    instansId: user.instansId,
  } });
  revalidatePath("/medier");
  redirect(`/medier/${media.id}?created=1`);
}

export async function updateMedia(mediaId: string, _: MediaFormState, formData: FormData): Promise<MediaFormState> {
  const user = await requireMediaManager();
  if (!user) return { error: "Du har ikke adgang til at redigere medier." };
  const existing = await db.media.findFirst({ where: { id: mediaId, instansId: user.instansId } });
  if (!existing) return { error: "Mediet findes ikke." };
  const metadata = metadataFrom(formData, existing.filtype);
  if (!metadata.success) return { error: "Kontrollér mediets metadata.", fieldErrors: metadata.error.flatten().fieldErrors };
  const imageError = validateRequiredImageMetadata(existing.filtype, metadata.data);
  if (imageError) return { error: imageError };
  await db.media.update({ where: { id: existing.id }, data: {
    altTekst: metadata.data.altTekst || null,
    billedtekst: metadata.data.billedtekst || null,
    ophavsperson: metadata.data.ophavsperson || null,
    rettighedsstatus: metadata.data.rettighedsstatus || null,
    licensType: metadata.data.licensType || null,
    rettighedsUdlob: parseRightsExpiry(metadata.data.rettighedsUdlob),
  } });
  revalidatePath("/medier");
  revalidatePath(`/medier/${existing.id}`);
  return { success: "Mediets metadata er gemt." };
}
