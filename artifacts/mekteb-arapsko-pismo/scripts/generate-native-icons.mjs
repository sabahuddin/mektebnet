#!/usr/bin/env node
/**
 * Generiše native ikone i splash-ove za iOS + Android Capacitor projekte.
 *
 * Zašto custom skripta umjesto @capacitor/assets?
 *   @capacitor/assets pinuje `sharp@0.32.6` koji ne radi na Node 24+
 *   (NAPI ABI mismatch). Root workspace ima sharp@0.34+ koji radi.
 *
 * Koristi: `node scripts/generate-native-icons.mjs`
 *
 * Ulaz: `assets/logo.png` (preferira 1024×1024 PNG, transparent BG).
 *
 * Generiše:
 *   iOS:
 *     - AppIcon-512@2x.png (1024×1024)
 *     - splash-2732x2732{,-1,-2}.png  (svi 2732×2732 sa centriranim logom)
 *   Android:
 *     - mipmap-{m,h,x,xx,xxx}hdpi/ic_launcher.png
 *     - mipmap-{m,h,x,xx,xxx}hdpi/ic_launcher_round.png
 *     - mipmap-{m,h,x,xx,xxx}hdpi/ic_launcher_foreground.png
 *     - drawable-{port,land}-{m,h,x,xx,xxx}hdpi/splash.png
 */
import sharp from "sharp";
import { mkdir, writeFile, access } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { constants } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(__dirname);
const LOGO = join(ROOT, "assets", "logo.png");
const IOS = join(ROOT, "ios", "App", "App", "Assets.xcassets");
const ANDROID = join(ROOT, "android", "app", "src", "main", "res");

const BRAND_TEAL = { r: 36, g: 143, b: 143, alpha: 1 };
const BG_CREAM = { r: 255, g: 250, b: 243, alpha: 1 };

async function exists(p) {
  try {
    await access(p, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function ensure(dir) {
  await mkdir(dir, { recursive: true });
}

/**
 * Pravi ikonu sa solid brand pozadinom + logo centriran (60% širine).
 * Apple traži opaque app icon (NEMA transparency).
 */
async function makeIcon(size) {
  const inner = Math.round(size * 0.6);
  const logo = await sharp(LOGO)
    .resize(inner, inner, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();
  return sharp({
    create: { width: size, height: size, channels: 4, background: BRAND_TEAL },
  })
    .composite([{ input: logo, gravity: "center" }])
    .png()
    .toBuffer();
}

/**
 * Android adaptive icon foreground: TRANSPARENT pozadina + logo manji
 * (40% safe zone), jer Android sam aplicira pozadinu.
 */
async function makeForeground(size) {
  const inner = Math.round(size * 0.4);
  const logo = await sharp(LOGO)
    .resize(inner, inner, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();
  return sharp({
    create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: logo, gravity: "center" }])
    .png()
    .toBuffer();
}

/**
 * Splash: 2732×2732 (ili odg. Android dim) sa kremastim BG i logom u centru
 * (33% širine — splash nije ikonica, treba dišuće prostora).
 */
async function makeSplash(width, height) {
  const inner = Math.round(Math.min(width, height) * 0.33);
  const logo = await sharp(LOGO)
    .resize(inner, inner, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();
  return sharp({
    create: { width, height, channels: 4, background: BG_CREAM },
  })
    .composite([{ input: logo, gravity: "center" }])
    .png()
    .toBuffer();
}

async function main() {
  if (!(await exists(LOGO))) {
    console.error(`Logo nije pronađen: ${LOGO}`);
    process.exit(1);
  }
  console.log("Generišem native ikone i splash-ove...");

  // --- iOS ---
  const iosIconDir = join(IOS, "AppIcon.appiconset");
  const iosSplashDir = join(IOS, "Splash.imageset");
  await ensure(iosIconDir);
  await ensure(iosSplashDir);
  await writeFile(join(iosIconDir, "AppIcon-512@2x.png"), await makeIcon(1024));
  const splash2732 = await makeSplash(2732, 2732);
  await writeFile(join(iosSplashDir, "splash-2732x2732.png"), splash2732);
  await writeFile(join(iosSplashDir, "splash-2732x2732-1.png"), splash2732);
  await writeFile(join(iosSplashDir, "splash-2732x2732-2.png"), splash2732);
  console.log("  ✓ iOS: AppIcon (1024) + Splash (2732)");

  // --- Android ---
  const densities = [
    { name: "mdpi", icon: 48, splashPort: [320, 480], splashLand: [480, 320] },
    { name: "hdpi", icon: 72, splashPort: [480, 800], splashLand: [800, 480] },
    { name: "xhdpi", icon: 96, splashPort: [720, 1280], splashLand: [1280, 720] },
    { name: "xxhdpi", icon: 144, splashPort: [960, 1600], splashLand: [1600, 960] },
    { name: "xxxhdpi", icon: 192, splashPort: [1280, 1920], splashLand: [1920, 1280] },
  ];

  // Adaptive icon foreground je 108dp safe area — generišemo 1.5x ikone veličine.
  for (const d of densities) {
    const mipDir = join(ANDROID, `mipmap-${d.name}`);
    await ensure(mipDir);
    const icon = await makeIcon(d.icon);
    const fgSize = Math.round(d.icon * 1.5);
    const fg = await makeForeground(fgSize);
    await writeFile(join(mipDir, "ic_launcher.png"), icon);
    await writeFile(join(mipDir, "ic_launcher_round.png"), icon);
    await writeFile(join(mipDir, "ic_launcher_foreground.png"), fg);

    const portDir = join(ANDROID, `drawable-port-${d.name}`);
    const landDir = join(ANDROID, `drawable-land-${d.name}`);
    await ensure(portDir);
    await ensure(landDir);
    await writeFile(join(portDir, "splash.png"), await makeSplash(...d.splashPort));
    await writeFile(join(landDir, "splash.png"), await makeSplash(...d.splashLand));
    console.log(`  ✓ Android ${d.name}: ${d.icon}px ikone + splash`);
  }

  // Android adaptive icon background — solid teal kao XML drawable.
  const valuesDir = join(ANDROID, "values");
  await ensure(valuesDir);
  await writeFile(
    join(valuesDir, "ic_launcher_background.xml"),
    `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">#248F8F</color>
</resources>
`,
  );
  console.log("  ✓ Android adaptive icon background color (#248F8F)");

  console.log("\nGotovo! Native asseti generirani.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
