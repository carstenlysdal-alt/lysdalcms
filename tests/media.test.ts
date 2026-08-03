import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { blocksSchema } from "../lib/blocks/schema";
import { parseRightsExpiry, validateRequiredImageMetadata } from "../lib/media";
import { optimizeImage } from "../lib/media-storage";

test("lokale medie-URL'er accepteres i billedblokke", () => {
  const result = blocksSchema.safeParse([{ id: "image-1", type: "image", data: { mediaId: "media-1", url: "/uploads/image.webp", alt: "Beskrivende alt-tekst", caption: "Billedtekst" } }]);
  assert.equal(result.success, true);
});

test("billedmetadata kræver alt-tekst og billedtekst", () => {
  assert.equal(validateRequiredImageMetadata("billede", { altTekst: "", billedtekst: "Tekst" }), "Billeder kræver en alt-tekst.");
  assert.equal(validateRequiredImageMetadata("billede", { altTekst: "Alt", billedtekst: "" }), "Billeder kræver en billedtekst.");
  assert.equal(validateRequiredImageMetadata("video", {}), null);
});

test("rettighedsudløb parses deterministisk", () => {
  assert.equal(parseRightsExpiry("2027-01-15")?.toISOString(), "2027-01-15T12:00:00.000Z");
  assert.equal(parseRightsExpiry(""), null);
});

test("uploadede billeder optimeres til WebP og maks. 2400 px", async () => {
  const input = await sharp({ create: { width: 3000, height: 1000, channels: 3, background: "#ec3013" } }).png().toBuffer();
  const output = await optimizeImage(input);
  const metadata = await sharp(output.data).metadata();
  assert.equal(output.mimeType, "image/webp");
  assert.equal(metadata.format, "webp");
  assert.equal(metadata.width, 2400);
  assert.equal(metadata.height, 800);
});
