#!/usr/bin/env node
/**
 * Provjera native mobile release konfiguracije bez ispisivanja secret vrijednosti.
 *
 * Pokreni nakon build:mobile:
 *   pnpm run mobile:verify
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";

const artifactRoot = process.cwd();
const repoRoot = resolve(artifactRoot, "../..");
const errors = [];
const checks = [];

function fileText(relativePath) {
  const absolutePath = resolve(artifactRoot, relativePath);
  if (!existsSync(absolutePath)) {
    errors.push(`nedostaje ${relativePath}`);
    return "";
  }
  return readFileSync(absolutePath, "utf8");
}

function requireText(relativePath, expected, label) {
  const content = fileText(relativePath);
  if (content && !content.includes(expected)) {
    errors.push(`${label}: ${relativePath}`);
    return;
  }
  if (content) checks.push(label);
}

const capacitorConfig = fileText("capacitor.config.ts");
if (capacitorConfig && !capacitorConfig.includes('appId: "net.mektebnet.app"')) {
  errors.push("Capacitor bundle ID nije net.mektebnet.app");
} else if (capacitorConfig) {
  checks.push("Capacitor bundle ID");
}

requireText(
  "android/app/build.gradle",
  'applicationId "net.mektebnet.app"',
  "Android application ID",
);
requireText(
  "android/app/src/main/AndroidManifest.xml",
  "android.permission.POST_NOTIFICATIONS",
  "Android notification permission",
);
requireText(
  "ios/App/App/App.entitlements",
  "aps-environment",
  "iOS APNs entitlement",
);

const packageJson = JSON.parse(fileText("package.json") || "{}");
if (packageJson.dependencies?.["onesignal-cordova-plugin"]) {
  checks.push("OneSignal Cordova plugin");
} else {
  errors.push("onesignal-cordova-plugin nije u dependencies");
}

const apiBase = process.env.VITE_API_BASE_URL || "https://mekteb.net/api";
if (apiBase !== "https://mekteb.net/api") {
  errors.push("mobile API URL mora biti https://mekteb.net/api");
} else {
  checks.push("production API URL");
}

const appId = process.env.VITE_ONESIGNAL_APP_ID || process.env.ONESIGNAL_APP_ID || "";
if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(appId)) {
  errors.push("OneSignal App ID nedostaje ili nije validnog UUID formata");
} else {
  checks.push("OneSignal App ID je postavljen");
}

const assetDir = resolve(artifactRoot, "dist/public/assets");
if (!existsSync(assetDir)) {
  errors.push("nedostaje dist/public/assets — prvo pokreni build:mobile");
} else {
  const nativeChunk = execFileSync(
    "find",
    [assetDir, "-maxdepth", "1", "-type", "f", "-name", "native-push-*.js", "-print"],
    { encoding: "utf8" },
  ).trim();
  if (!nativeChunk) {
    errors.push("native-push chunk nije pronađen u mobile bundleu");
  } else if (!readFileSync(nativeChunk.split("\n")[0], "utf8").includes(appId)) {
    errors.push("OneSignal App ID nije pronađen u native mobile bundleu");
  } else {
    checks.push("OneSignal App ID je ugrađen u bundle");
  }
}

const trackedFiles = execFileSync("git", ["ls-files", "-z", "--", "artifacts/mekteb-arapsko-pismo"], {
  cwd: repoRoot,
  encoding: "utf8",
})
  .split("\0")
  .filter(Boolean);
const secretFilePattern = /(^|\/)(google-services\.json|[^/]*service-account[^/]*\.json|[^/]*\.p8|[^/]*\.(jks|keystore))$/i;
const trackedSecrets = trackedFiles.filter((file) => secretFilePattern.test(file));
if (trackedSecrets.length > 0) {
  errors.push("osjetljiv native credential fajl je praćen u Git-u");
} else {
  checks.push("native credentials nisu praćeni u Git-u");
}

if (errors.length > 0) {
  console.error("Mobile config provjera NIJE prošla:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Mobile config provjera prošla (${checks.length} provjera).`);