import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const src = resolve(root, "public/logo-mekteb.png");
const outDir = resolve(root, "public/icons");

await mkdir(outDir, { recursive: true });

const BRAND_TEAL = { r: 36, g: 143, b: 143, alpha: 1 };
const WHITE = { r: 255, g: 255, b: 255, alpha: 1 };

async function makeIcon({ size, padding, bg, name }) {
  const inner = Math.round(size * (1 - padding * 2));
  const logo = await sharp(src)
    .resize(inner, inner, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .toBuffer();

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: bg,
    },
  })
    .composite([{ input: logo, gravity: "center" }])
    .png()
    .toFile(resolve(outDir, name));

  console.log(`✓ ${name} (${size}×${size})`);
}

await Promise.all([
  makeIcon({ size: 192, padding: 0.08, bg: BRAND_TEAL, name: "icon-192.png" }),
  makeIcon({ size: 512, padding: 0.08, bg: BRAND_TEAL, name: "icon-512.png" }),
  makeIcon({ size: 512, padding: 0.18, bg: BRAND_TEAL, name: "icon-512-maskable.png" }),
  makeIcon({ size: 180, padding: 0.06, bg: BRAND_TEAL, name: "apple-touch-icon.png" }),
  makeIcon({ size: 167, padding: 0.06, bg: BRAND_TEAL, name: "apple-touch-icon-167.png" }),
  makeIcon({ size: 152, padding: 0.06, bg: BRAND_TEAL, name: "apple-touch-icon-152.png" }),
  makeIcon({ size: 120, padding: 0.06, bg: BRAND_TEAL, name: "apple-touch-icon-120.png" }),
  makeIcon({ size: 32, padding: 0.04, bg: WHITE, name: "favicon-32.png" }),
  makeIcon({ size: 16, padding: 0.04, bg: WHITE, name: "favicon-16.png" }),
]);

console.log("\nAll PWA icons generated in public/icons/");
