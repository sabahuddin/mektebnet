import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { db, staticVjezbeIzvoriTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { getStaticVjezba } from "./static-vjezbe.js";

const MAX_SOURCE_HTML_BYTES = 2 * 1024 * 1024;
const sourceDir = path.dirname(fileURLToPath(import.meta.url));
const LEGACY_PATCH_START = "    // This legacy exercise is distributed as a compressed bundler template.";
const LEGACY_PATCH_END = "    // Nested page bundles (iframe targets).";
const LEGACY_TEMPLATE_PARSE = "    let template = JSON.parse(templateEl.textContent);";
const REORDER_SHUFFLE_MARKER = "<!-- mekteb-reorder-shuffle -->";

export function getStaticVjezbaSourceLimit(): number {
  return MAX_SOURCE_HTML_BYTES;
}

function bundledSourceCandidates(key: string): string[] {
  const relative = path.join("vjezbe", `${key}.html`);
  return [
    path.resolve(sourceDir, "../../../mekteb-arapsko-pismo/dist/public", relative),
    path.resolve(sourceDir, "../../../mekteb-arapsko-pismo/public", relative),
    path.resolve(process.cwd(), "artifacts/mekteb-arapsko-pismo/dist/public", relative),
    path.resolve(process.cwd(), "artifacts/mekteb-arapsko-pismo/public", relative),
    path.resolve(process.cwd(), "../mekteb-arapsko-pismo/dist/public", relative),
    path.resolve(process.cwd(), "../mekteb-arapsko-pismo/public", relative),
  ];
}

export async function readBundledStaticVjezba(key: string): Promise<string> {
  if (!getStaticVjezba(key)) throw new Error(`Nepoznata statička vježba: ${key}`);
  for (const candidate of bundledSourceCandidates(key)) {
    try {
      return await fs.readFile(candidate, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  throw new Error(`Bundlovani izvor vježbe nije pronađen: ${key}`);
}

export async function getEffectiveStaticVjezbaSource(key: string): Promise<{
  sourceHtml: string;
  hasOverride: boolean;
}> {
  const [override] = await db
    .select({ sourceHtml: staticVjezbeIzvoriTable.sourceHtml })
    .from(staticVjezbeIzvoriTable)
    .where(eq(staticVjezbeIzvoriTable.key, key));
  if (override) return { sourceHtml: override.sourceHtml, hasOverride: true };
  return { sourceHtml: await readBundledStaticVjezba(key), hasOverride: false };
}

export function applyLegacyStaticVjezbaRuntimePatch(
  sourceHtml: string,
  patchedBundledHtml: string,
): string {
  if (sourceHtml.includes('id="mekteb-nivo3-restyle"')) return sourceHtml;

  const patchStart = patchedBundledHtml.indexOf(LEGACY_PATCH_START);
  const patchEnd = patchedBundledHtml.indexOf(LEGACY_PATCH_END, patchStart);
  if (patchStart < 0 || patchEnd < 0) return sourceHtml;
  const patch = patchedBundledHtml.slice(patchStart, patchEnd);

  const currentStart = sourceHtml.indexOf(LEGACY_PATCH_START);
  const currentEnd = sourceHtml.indexOf(LEGACY_PATCH_END, currentStart);
  if (currentStart >= 0 && currentEnd >= 0) {
    return sourceHtml.slice(0, currentStart) + patch + sourceHtml.slice(currentEnd);
  }

  const parseAt = sourceHtml.indexOf(LEGACY_TEMPLATE_PARSE);
  if (parseAt < 0) return sourceHtml;
  const insertAt = parseAt + LEGACY_TEMPLATE_PARSE.length;
  return sourceHtml.slice(0, insertAt) + "\n\n" + patch + sourceHtml.slice(insertAt);
}

export function applyStaticVjezbaReorderShuffle(sourceHtml: string): string {
  if (sourceHtml.includes(REORDER_SHUFFLE_MARKER)) return sourceHtml;

  let patched = sourceHtml
    .replace(
      'if (!Array.isArray(p.opcije) || p.vrsta === "reorder") return;',
      'if (p.vrsta === "reorder" && Array.isArray(p.stavke)){ p.izmijesaneStavke = fisherYates(p.stavke.slice()); return; }\n    if (!Array.isArray(p.opcije)) return;',
    )
    .replace(
      'if(!Array.isArray(p.opcije)||p.vrsta==="reorder")return;',
      'if(p.vrsta==="reorder"&&Array.isArray(p.stavke)){p.izmijesaneStavke=fisherYates(p.stavke.slice());return;}if(!Array.isArray(p.opcije))return;',
    );

  // Kartice se miješaju, dok p.stavke ostaje kanonski redoslijed za slotove
  // i provjeru. Legacy 11–20 renderer koristi `chips`, ostali obični DOM.
  patched = patched
    .replace(
      "p.stavke.forEach(function(sv){",
      "(p.izmijesaneStavke || p.stavke).forEach(function(sv){",
    )
    .replace(
      "chips: q.stavke.map(sv => ({",
      "chips: (q.izmijesaneStavke || q.stavke).map(sv => ({",
    );

  if (patched === sourceHtml) return sourceHtml;
  return patched.replace(/(<head(?:\s[^>]*)?>)/i, `$1\n${REORDER_SHUFFLE_MARKER}`);
}

export function validateStaticVjezbaSource(sourceHtml: unknown): string | null {
  if (typeof sourceHtml !== "string" || !sourceHtml.trim()) {
    return "HTML izvor ne može biti prazan";
  }
  if (Buffer.byteLength(sourceHtml, "utf8") > MAX_SOURCE_HTML_BYTES) {
    return "HTML izvor je prevelik (maksimalno 2 MB)";
  }
  // These markers are part of the iframe contract.  Do not accept an
  // override which can render but can never report completion to the parent.
  if (!/mekteb\.exercise\.v1/.test(sourceHtml)
    || !/postMessage\s*\(/.test(sourceHtml)
    || /(?:\\?["']type\\?["']|\btype)\s*:\s*(?:\\?["']complete\\?["'])/.test(sourceHtml) === false
    || /(?:\\?["']exerciseKey\\?["']|\bexerciseKey)\s*:/.test(sourceHtml) === false
    || /(?:\\?["']maxScore\\?["']|\bmaxScore)\s*:/.test(sourceHtml) === false) {
    return "HTML mora sadržavati protokol mekteb.exercise.v1 i complete poruku";
  }
  return null;
}