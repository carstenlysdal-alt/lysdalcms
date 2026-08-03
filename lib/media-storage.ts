import sharp from "sharp";

export async function optimizeImage(input: Buffer) {
  const { data, info } = await sharp(input, { failOn: "warning" })
    .rotate()
    .resize({ width: 2400, height: 2400, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height, size: info.size, mimeType: "image/webp" as const };
}
