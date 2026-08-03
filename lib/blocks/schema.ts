import { z } from "zod";

const base = z.object({ id: z.string().min(1) });
const mediaUrl = z.string().refine((value) => value.startsWith("/") || URL.canParse(value), "Angiv en gyldig medie-URL.");

export const blockSchemas = {
  paragraph: base.extend({ type: z.literal("paragraph"), data: z.object({ content: z.string() }) }),
  heading: base.extend({ type: z.literal("heading"), data: z.object({ text: z.string(), level: z.union([z.literal(2), z.literal(3)]) }) }),
  subheading: base.extend({ type: z.literal("subheading"), data: z.object({ text: z.string() }) }),
  manchet: base.extend({ type: z.literal("manchet"), data: z.object({ text: z.string() }) }),
  quote: base.extend({ type: z.literal("quote"), data: z.object({ quote: z.string(), attribution: z.string().optional() }) }),
  factbox: base.extend({ type: z.literal("factbox"), data: z.object({ title: z.string(), content: z.string() }) }),
  image: base.extend({ type: z.literal("image"), data: z.object({ mediaId: z.string().optional(), url: mediaUrl, alt: z.string().min(1), caption: z.string().optional() }) }),
  infobox: base.extend({ type: z.literal("infobox"), data: z.object({ title: z.string(), content: z.string() }) }),
} as const;

export const blockSchema = z.discriminatedUnion("type", [
  blockSchemas.paragraph,
  blockSchemas.heading,
  blockSchemas.subheading,
  blockSchemas.manchet,
  blockSchemas.quote,
  blockSchemas.factbox,
  blockSchemas.image,
  blockSchemas.infobox,
]);
export const blocksSchema = z.array(blockSchema);
export type Block = z.infer<typeof blockSchema>;
export type BlockType = Block["type"];

export function parseBlocks(value: unknown): Block[] {
  return blocksSchema.parse(value);
}
