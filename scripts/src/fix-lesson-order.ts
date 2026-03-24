/**
 * Update redoslijed (ordering) of ilmihal lekcije based on engine.js ordering
 */
import AdmZip from "adm-zip";
import { db } from "@workspace/db";
import { ilmihalLekcijeTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ZIP_PATH = path.join(__dirname, "../../attached_assets/edu_1774348311515.zip");

function extractPodaci(content: string, varName: string): Array<{ n: string; f: string }> {
  const start = content.indexOf(`this.${varName} = [`);
  if (start === -1) return [];
  let i = content.indexOf("[", start);
  let depth = 0;
  let result = "";
  for (; i < content.length; i++) {
    if (content[i] === "[") depth++;
    result += content[i];
    if (content[i] === "]") {
      depth--;
      if (depth === 0) break;
    }
  }
  const matches = result.matchAll(/\{\s*n:\s*"([^"]*)"\s*,\s*f:\s*"([^"]*)"\s*\}/g);
  return Array.from(matches).map(m => ({ n: m[1], f: m[2] }));
}

function fileToSlug(filename: string): string {
  return path.basename(filename, ".html").replace(/_/g, "-");
}

async function fixOrder() {
  console.log("📋 Fixing lesson ordering from engine.js...\n");

  const zip = new AdmZip(ZIP_PATH);
  const engineEntry = zip.getEntries().find(e => e.entryName.includes("engine.js"));
  if (!engineEntry) throw new Error("engine.js not found in ZIP");

  const engineContent = zip.readAsText(engineEntry);
  const podaci1 = extractPodaci(engineContent, "podaci1");
  const podaci2 = extractPodaci(engineContent, "podaci2");
  const podaci3 = extractPodaci(engineContent, "podaci3");

  console.log(`Found: ${podaci1.length} nivo1, ${podaci2.length} nivo2, ${podaci3.length} nivo3 lessons\n`);

  let updated = 0;
  let notFound = 0;

  for (const [podaci, nivo] of [[podaci1, 1], [podaci2, 2], [podaci3, 3]] as const) {
    for (let i = 0; i < podaci.length; i++) {
      const slug = fileToSlug(podaci[i].f);
      const naslov = podaci[i].n;

      // Try to find by slug + nivo
      const rows = await db
        .select({ id: ilmihalLekcijeTable.id, slug: ilmihalLekcijeTable.slug })
        .from(ilmihalLekcijeTable)
        .where(and(eq(ilmihalLekcijeTable.slug, slug), eq(ilmihalLekcijeTable.nivo, nivo)));

      if (rows.length > 0) {
        await db
          .update(ilmihalLekcijeTable)
          .set({ redoslijed: i, naslov })
          .where(eq(ilmihalLekcijeTable.id, rows[0].id));
        updated++;
      } else {
        // Try just by slug (some slugs exist in different nivo)
        const rowsAny = await db
          .select({ id: ilmihalLekcijeTable.id, nivo: ilmihalLekcijeTable.nivo })
          .from(ilmihalLekcijeTable)
          .where(eq(ilmihalLekcijeTable.slug, slug));

        if (rowsAny.length > 0) {
          // Pick the first matching
          await db
            .update(ilmihalLekcijeTable)
            .set({ redoslijed: i, naslov })
            .where(eq(ilmihalLekcijeTable.id, rowsAny[0].id));
          updated++;
          console.log(`  ⚠️  nivo${nivo}/${slug} — found in nivo${rowsAny[0].nivo} (slug conflict)`);
        } else {
          notFound++;
          if (notFound <= 5) console.log(`  ❌ NOT FOUND: nivo${nivo}/${slug} (${naslov})`);
        }
      }
    }
  }

  console.log(`\n✅ Updated: ${updated} lekcija`);
  console.log(`❌ Not found: ${notFound} lekcija`);
}

fixOrder().catch(console.error).finally(() => process.exit(0));
