/**
 * One-time fix: normalise image src paths in ilmihal_lekcije contentHtml
 * Converts relative ../../assets/images/ to /edu/assets/images/
 */
import { db } from "@workspace/db";
import { ilmihalLekcijeTable } from "@workspace/db/schema";
import { like, sql } from "drizzle-orm";

async function fixPaths() {
  console.log("🔧 Fixing image paths in ilmihal_lekcije...");

  // Use SQL REPLACE to fix paths in the database directly
  const result = await db.execute(sql`
    UPDATE ilmihal_lekcije
    SET content_html = regexp_replace(
      content_html,
      'src="(\.\./)*assets/images/',
      'src="/edu/assets/images/',
      'g'
    )
    WHERE content_html ~ 'assets/images/'
    RETURNING id, slug
  `);

  console.log(`✅ Updated ${result.rows.length} lekcija`);
  result.rows.slice(0, 10).forEach((r: any) => console.log(`  - ${r.slug}`));
  if (result.rows.length > 10) console.log(`  ... i još ${result.rows.length - 10}`);
}

fixPaths().catch(console.error).finally(() => process.exit(0));
