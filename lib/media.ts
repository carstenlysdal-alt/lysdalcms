import { z } from "zod";

export const MEDIA_TYPES = ["billede", "video", "lyd", "dokument"] as const;
export type MediaType = (typeof MEDIA_TYPES)[number];

export const mediaMetadataSchema = z.object({
  filtype: z.enum(MEDIA_TYPES),
  altTekst: z.string().trim().max(500).optional(),
  billedtekst: z.string().trim().max(1000).optional(),
  ophavsperson: z.string().trim().max(200).optional(),
  rettighedsstatus: z.string().trim().max(200).optional(),
  licensType: z.string().trim().max(100).optional(),
  rettighedsUdlob: z.string().trim().optional(),
});

export const ALLOWED_UPLOADS: Record<string, { type: MediaType; extension: string }> = {
  "image/jpeg": { type: "billede", extension: "jpg" },
  "image/png": { type: "billede", extension: "png" },
  "image/webp": { type: "billede", extension: "webp" },
  "video/mp4": { type: "video", extension: "mp4" },
  "video/webm": { type: "video", extension: "webm" },
  "audio/mpeg": { type: "lyd", extension: "mp3" },
  "audio/wav": { type: "lyd", extension: "wav" },
  "audio/ogg": { type: "lyd", extension: "ogg" },
  "application/pdf": { type: "dokument", extension: "pdf" },
};

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export function validateRequiredImageMetadata(
  type: string,
  metadata: { altTekst?: string; billedtekst?: string },
) {
  if (type !== "billede") return null;
  if (!metadata.altTekst?.trim()) return "Billeder kræver en alt-tekst.";
  if (!metadata.billedtekst?.trim()) return "Billeder kræver en billedtekst.";
  return null;
}

export function parseRightsExpiry(value?: string) {
  if (!value) return null;
  const date = new Date(`${value}T12:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}
