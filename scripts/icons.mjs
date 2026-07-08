// Rasterize public/favicon.svg into the PWA/iOS icon set.
// Usage: node scripts/icons.mjs
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = path.join(root, "public");

const masterSvg = await readFile(path.join(publicDir, "favicon.svg"));

// iOS applies its own superellipse mask to home-screen icons, so the
// apple-touch-icon must be a full square: same art, but with the rounded
// corners removed from the background.
const appleSvg = Buffer.from(
  masterSvg.toString("utf8").replace(
    '<rect width="512" height="512" rx="113" fill="url(#bg)"/>',
    '<rect width="512" height="512" fill="url(#bg)"/>'
  )
);

const targets = [
  { file: "pwa-192.png", size: 192, svg: masterSvg },
  { file: "pwa-512.png", size: 512, svg: masterSvg },
  { file: "apple-touch-icon.png", size: 180, svg: appleSvg },
];

for (const { file, size, svg } of targets) {
  const png = await sharp(svg, { density: 300 })
    .resize(size, size)
    .png()
    .toBuffer();
  await writeFile(path.join(publicDir, file), png);
  console.log(`wrote public/${file} (${size}x${size}, ${png.length} bytes)`);
}
