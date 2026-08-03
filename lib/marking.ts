import { z } from "zod";

export const CONTENT_TYPES = ["Uafhængig", "Partner", "Sponsoreret", "Brugerindsendt", "PR"] as const;
export type ContentType = (typeof CONTENT_TYPES)[number];

export const markingSchema = z.object({
  sponsor: z.string().trim().min(2, "Angiv sponsor eller partner."),
  labelTekst: z.string().trim().min(2, "Angiv den synlige mærkningstekst."),
  aftaleId: z.string().trim().optional(),
});

export type Marking = z.infer<typeof markingSchema>;

export function validateMarking(indholdstype: string, marking: unknown) {
  if (indholdstype !== "Partner" && indholdstype !== "Sponsoreret") {
    return { success: true as const, data: null };
  }
  const result = markingSchema.safeParse(marking);
  if (!result.success) {
    return {
      success: false as const,
      error: "Partner- og sponsoreret indhold kan ikke publiceres uden sponsor og tydelig mærkning.",
    };
  }
  return { success: true as const, data: result.data };
}

export function assertPublishableMarking(indholdstype: string, marking: unknown) {
  const result = validateMarking(indholdstype, marking);
  if (!result.success) throw new Error(result.error);
}
