// Rasterise the brand app icon (docs/design/brand) into the PNG sizes the PWA needs.
// Usage: npm run icons
import { mkdir, copyFile } from "node:fs/promises";
import sharp from "sharp";

const SRC = "docs/design/brand/icon.svg";
const MASKABLE = "docs/design/brand/icon-maskable.svg";
const OUT = "public/icons";

await mkdir(OUT, { recursive: true });
await mkdir("public/brand", { recursive: true });
for (const f of ["icon.svg", "icon-maskable.svg", "wordmark.svg"]) await copyFile(`docs/design/brand/${f}`, `public/brand/${f}`);

const jobs = [
  { src: SRC, size: 192, file: "icon-192.png" },
  { src: SRC, size: 512, file: "icon-512.png" },
  { src: MASKABLE, size: 512, file: "maskable-512.png" },
  // iOS draws its own rounded mask, so the apple icon uses the full-bleed artwork.
  { src: MASKABLE, size: 180, file: "apple-touch-icon.png" },
  { src: SRC, size: 32, file: "favicon-32.png" },
];
for (const j of jobs) {
  await sharp(j.src, { density: 384 }).resize(j.size, j.size).png({ compressionLevel: 9 }).toFile(`${OUT}/${j.file}`);
  console.log(`wrote ${OUT}/${j.file}`);
}
