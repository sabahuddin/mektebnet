import { db, ilmihalLekcijeTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { createHash } from "node:crypto";

/** Keep the published private version intact while its author works on a draft. */
export async function savePrivateLesson(
  id: number, authorId: number, html: string, language: string, publish: boolean,
) {
  return db.transaction(async (tx) => {
    const [lesson] = await tx.select().from(ilmihalLekcijeTable)
      .where(eq(ilmihalLekcijeTable.id, id)).for("update");
    if (!lesson || lesson.autorMuallimId !== authorId
      || lesson.dostupnost !== "autorovi_ucenici" || lesson.statusOdobrenja === "odbijeno") {
      return false;
    }
    if (publish && language !== "bs" && !lesson.isPublished) {
      throw new Error("Prvo objavite izvorni bosanski sadržaj lekcije.");
    }
    await tx.execute(sql`
      DELETE FROM izmjene_lekcija
      WHERE lekcija_id = ${id} AND predlozio_id = ${authorId}
        AND jezik = ${language} AND status IN ('nacrt', 'na_cekanju')
    `);
    if (!publish) {
      if (!lesson.isPublished) {
        await tx.update(ilmihalLekcijeTable).set({ statusOdobrenja: "nacrt" })
          .where(eq(ilmihalLekcijeTable.id, id));
      }
      await tx.execute(sql`
        INSERT INTO izmjene_lekcija (lekcija_id, predlozeni_html, jezik, predlozio_id, status)
        VALUES (${id}, ${html}, ${language}, ${authorId}, 'nacrt')
      `);
      return true;
    }
    if (language === "bs") {
      await tx.update(ilmihalLekcijeTable).set({
        contentHtml: html, isPublished: true, statusOdobrenja: "odobreno",
      }).where(eq(ilmihalLekcijeTable.id, id));
    } else {
      const hash = createHash("sha256").update(lesson.contentHtml).digest("hex");
      await tx.execute(sql`
        INSERT INTO content_prijevodi
          (tabela, red_id, polje, jezik, prijevod, izvor_hash, updated_at)
        VALUES ('ilmihal_lekcije', ${id}, 'content_html', ${language}, ${html}, ${hash}, NOW())
        ON CONFLICT (tabela, red_id, polje, jezik)
        DO UPDATE SET prijevod = EXCLUDED.prijevod, izvor_hash = EXCLUDED.izvor_hash, updated_at = NOW()
      `);
    }
    return true;
  });
}
