import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { createHash } from "node:crypto";
import { normalizeSurahNames, normalizeSurahNamesDeep } from "./surah-names.js";

type QueryResult<T> = { rows: T[] };

function jsonEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export interface SurahNormalizationResult {
  pitanjaUpdated: number;
  pitanjaMerged: number;
  lekcijeUpdated: number;
  kvizoviUpdated: number;
  programUpdated: number;
  prijevodiUpdated: number;
}

export async function normalizeStoredSurahNames(): Promise<SurahNormalizationResult> {
  return db.transaction(async (tx) => {
    const rows = async <T>(query: ReturnType<typeof sql>): Promise<T[]> => {
      const queryResult = await tx.execute(query) as unknown as QueryResult<T>;
      return queryResult.rows;
    };
    const result: SurahNormalizationResult = {
      pitanjaUpdated: 0,
      pitanjaMerged: 0,
      lekcijeUpdated: 0,
      kvizoviUpdated: 0,
      programUpdated: 0,
      prijevodiUpdated: 0,
    };

    const pitanja = await rows<{
      id: number;
      pitanje: string;
      opcije: unknown;
      objasnjenje: string;
      meta: unknown;
      vrsta: string;
    }>(sql`SELECT id, pitanje, opcije, objasnjenje, meta, vrsta FROM pitanja_banka ORDER BY id`);

    const canonicalByKey = new Map<string, number>();
    const normalizedById = new Map<number, {
      pitanje: string;
      opcije: unknown;
      objasnjenje: string;
      meta: unknown;
    }>();

    for (const row of pitanja) {
      const normalized = {
        pitanje: normalizeSurahNames(row.pitanje),
        opcije: normalizeSurahNamesDeep(row.opcije),
        objasnjenje: normalizeSurahNames(row.objasnjenje),
        meta: normalizeSurahNamesDeep(row.meta),
      };
      normalizedById.set(row.id, normalized);
      const key = row.vrsta === "dragDrop" || row.vrsta === "markWords"
        ? `${row.vrsta}|${normalized.pitanje}|${JSON.stringify(normalized.meta)}`
        : `standard|${normalized.pitanje}`;
      const currentTarget = canonicalByKey.get(key);
      if (currentTarget === undefined || row.pitanje === normalized.pitanje) {
        canonicalByKey.set(key, row.id);
      }
    }

    const processedTargets = new Set<number>();
    for (const row of pitanja) {
      const normalized = normalizedById.get(row.id)!;
      const key = row.vrsta === "dragDrop" || row.vrsta === "markWords"
        ? `${row.vrsta}|${normalized.pitanje}|${JSON.stringify(normalized.meta)}`
        : `standard|${normalized.pitanje}`;
      const targetId = canonicalByKey.get(key)!;

      if (targetId !== row.id) {
        await tx.execute(sql`
          INSERT INTO kviz_pitanja (kviz_id, pitanje_id, redoslijed, created_at)
          SELECT kviz_id, ${targetId}, redoslijed, created_at
          FROM kviz_pitanja
          WHERE pitanje_id = ${row.id}
          ON CONFLICT (kviz_id, pitanje_id) DO NOTHING
        `);
        await tx.execute(sql`DELETE FROM kviz_pitanja WHERE pitanje_id = ${row.id}`);
        await tx.execute(sql`DELETE FROM pitanja_banka WHERE id = ${row.id}`);
        result.pitanjaMerged++;
        continue;
      }

      if (processedTargets.has(targetId)) continue;
      processedTargets.add(targetId);
      const changed = normalized.pitanje !== row.pitanje
        || normalized.objasnjenje !== row.objasnjenje
        || !jsonEqual(normalized.opcije, row.opcije)
        || !jsonEqual(normalized.meta, row.meta);
      if (!changed) continue;

      await tx.execute(sql`
        UPDATE pitanja_banka
        SET pitanje = ${normalized.pitanje},
            opcije = ${JSON.stringify(normalized.opcije)}::jsonb,
            objasnjenje = ${normalized.objasnjenje},
            meta = ${normalized.meta === null ? null : JSON.stringify(normalized.meta)}::jsonb,
            updated_at = NOW()
        WHERE id = ${row.id}
      `);
      result.pitanjaUpdated++;
    }

    const lekcije = await rows<{
      id: number;
      naslov: string;
      content_html: string;
      kviz_pitanja: unknown;
    }>(sql`SELECT id, naslov, content_html, kviz_pitanja FROM ilmihal_lekcije`);
    for (const row of lekcije) {
      const naslov = normalizeSurahNames(row.naslov);
      const contentHtml = normalizeSurahNames(row.content_html);
      const kvizPitanja = normalizeSurahNamesDeep(row.kviz_pitanja);
      if (naslov === row.naslov && contentHtml === row.content_html && jsonEqual(kvizPitanja, row.kviz_pitanja)) continue;
      await tx.execute(sql`
        UPDATE ilmihal_lekcije
        SET naslov = ${naslov},
            content_html = ${contentHtml},
            kviz_pitanja = ${kvizPitanja === null ? null : JSON.stringify(kvizPitanja)}::jsonb
        WHERE id = ${row.id}
      `);
      result.lekcijeUpdated++;
    }

    const lessonsById = new Map(lekcije.map((row) => {
      const normalized = {
        naslov: normalizeSurahNames(row.naslov),
        content_html: normalizeSurahNames(row.content_html),
        kviz_pitanja: normalizeSurahNamesDeep(row.kviz_pitanja),
      };
      return [row.id, normalized] as const;
    }));
    const prijevodi = await rows<{
      id: number;
      red_id: number;
      polje: "naslov" | "content_html" | "kviz_pitanja";
      prijevod: string;
      izvor_hash: string | null;
    }>(sql`
      SELECT id, red_id, polje, prijevod, izvor_hash
      FROM content_prijevodi
      WHERE tabela = 'ilmihal_lekcije'
        AND polje IN ('naslov', 'content_html', 'kviz_pitanja')
    `);
    for (const row of prijevodi) {
      const lesson = lessonsById.get(row.red_id);
      if (!lesson) continue;
      const prijevod = normalizeSurahNames(row.prijevod);
      const sourceValue = row.polje === "kviz_pitanja"
        ? JSON.stringify(lesson.kviz_pitanja ?? "")
        : String(lesson[row.polje] ?? "");
      const izvorHash = createHash("sha256").update(sourceValue, "utf8").digest("hex");
      if (prijevod === row.prijevod && izvorHash === row.izvor_hash) continue;
      await tx.execute(sql`
        UPDATE content_prijevodi
        SET prijevod = ${prijevod}, izvor_hash = ${izvorHash}, updated_at = NOW()
        WHERE id = ${row.id}
      `);
      result.prijevodiUpdated++;
    }

    const kvizovi = await rows<{
      id: number;
      naslov: string;
      opis: string;
      pitanja: unknown;
    }>(sql`SELECT id, naslov, opis, pitanja FROM kvizovi`);
    for (const row of kvizovi) {
      const naslov = normalizeSurahNames(row.naslov);
      const opis = normalizeSurahNames(row.opis);
      const pitanjaJson = normalizeSurahNamesDeep(row.pitanja);
      if (naslov === row.naslov && opis === row.opis && jsonEqual(pitanjaJson, row.pitanja)) continue;
      await tx.execute(sql`
        UPDATE kvizovi
        SET naslov = ${naslov},
            opis = ${opis},
            pitanja = ${JSON.stringify(pitanjaJson)}::jsonb
        WHERE id = ${row.id}
      `);
      result.kvizoviUpdated++;
    }

    for (const table of ["napamet_program", "napamet_global_program", "napamet_muallim_program"] as const) {
      const programRows = await rows<{ id: number; naziv: string }>(
        sql.raw(`SELECT id, naziv FROM ${table}`),
      );
      for (const row of programRows) {
        const naziv = normalizeSurahNames(row.naziv);
        if (naziv === row.naziv) continue;
        if (table === "napamet_program") {
          await tx.execute(sql`UPDATE napamet_program SET naziv = ${naziv} WHERE id = ${row.id}`);
        } else if (table === "napamet_global_program") {
          await tx.execute(sql`UPDATE napamet_global_program SET naziv = ${naziv}, updated_at = NOW() WHERE id = ${row.id}`);
        } else {
          await tx.execute(sql`UPDATE napamet_muallim_program SET naziv = ${naziv}, updated_at = NOW() WHERE id = ${row.id}`);
        }
        result.programUpdated++;
      }
    }

    return result;
  });
}