import fs from "node:fs";
import path from "node:path";
import { db } from "@workspace/db";
import { ilmihalLekcijeTable, prilozi } from "@workspace/db/schema";
import { inArray } from "drizzle-orm";

type BundledMaterial = {
  slug: string;
  title: string;
  directory?: string;
};

const MATERIAL_DIR = "nivo2-popuni-prazninu";
const MATERIAL_DIR_31_60 = "nivo2-popuni-prazninu-31-60";
const MATERIAL_DIR_61_68 = "nivo2-popuni-prazninu-61-68";

const NIV0_2_FILL_IN_MATERIALS: BundledMaterial[] = [
  { slug: "adem-as", title: "Adem, a.s." },
  { slug: "mentu-billahi", title: "Prvi imanski šart — Āmentu billāhi" },
  { slug: "sifatuz-zatijje", title: "Es-sifatuz-zatijje, općenito" },
  { slug: "sifatus-subutijje", title: "Es-sifatus-subutijje, općenito" },
  { slug: "ve-melaikethi", title: "Drugi imanski šart — ve melāiketihī" },
  { slug: "ve-kutubihi", title: "Treći imanski šart — ve kutubihī" },
  { slug: "ve-rusulihi", title: "Četvrti imanski šart — ve rusulihī" },
  { slug: "vel-jevmil-ahiri", title: "Peti imanski šart — vel-jevmil āhiri" },
  { slug: "ve-bil-kaderi", title: "Šesti imanski šart — ve bil-kaderi" },
  { slug: "el-kafirun", title: "Učenje sure El-Kafirun" },
  { slug: "islamski-sarti", title: "Prvi islamski šart — Kelimei-šehadet" },
  { slug: "namaz", title: "Drugi islamski šart — namaz" },
  { slug: "sta-kvari-namaz", title: "Šta kvari namaz" },
  { slug: "sehvi-sedzda", title: "Sehvi-sedžda" },
  { slug: "naklanjavanje", title: "Naklanjavanje namaza" },
  { slug: "namaz-u-dzematu", title: "Namaz u džematu" },
  { slug: "prispijevanje", title: "Prispijevanje u džemat" },
  { slug: "post", title: "Treći islamski šart — post" },
  { slug: "zekat", title: "Četvrti islamski šart — zekat" },
  { slug: "hadz", title: "Peti islamski šart — hadž" },
  { slug: "urednost", title: "Urednost muslimana" },
  { slug: "cistoca", title: "Čistoća i lična higijena" },
  { slug: "zdravlje", title: "Dužnost čuvanja zdravlja" },
  { slug: "ishrana", title: "Zdrava ishrana" },
  { slug: "ponasanje-jela", title: "Ponašanje prilikom jela" },
  { slug: "dova-poslije-jela", title: "Učenje dove poslije jela" },
  { slug: "ljubav-poslusnost-roditelji", title: "Ljubav i poslušnost prema roditeljima" },
  { slug: "braca-sestre", title: "Pažnja prema sestrama i braći" },
  { slug: "rodbina", title: "Dužnosti prema rodbini" },
  { slug: "namaz-cuva", title: "Namaz čuva i odgaja" },
  { slug: "podne-namaz", title: "Podne-namaz", directory: MATERIAL_DIR_31_60 },
  { slug: "tejemum", title: "Tejemum — simbolično čišćenje", directory: MATERIAL_DIR_31_60 },
  { slug: "mesh", title: "Mesh po mestvama i zavoju", directory: MATERIAL_DIR_31_60 },
  { slug: "el-kevser", title: "Učenje sure El-Kevser", directory: MATERIAL_DIR_31_60 },
  { slug: "mali-grijesi", title: "Vrste grijeha — mali grijesi", directory: MATERIAL_DIR_31_60 },
  { slug: "veliki-grijesi", title: "Veliki grijesi", directory: MATERIAL_DIR_31_60 },
  { slug: "teski-grijesi", title: "Teški grijesi", directory: MATERIAL_DIR_31_60 },
  { slug: "posljedice-grijeha", title: "Posljedice grijeha", directory: MATERIAL_DIR_31_60 },
  { slug: "tevba", title: "Tevba — pokajanje", directory: MATERIAL_DIR_31_60 },
  { slug: "cestitost", title: "Čestitost i odgovornost", directory: MATERIAL_DIR_31_60 },
  { slug: "iskrenost", title: "Iskrenost i saosjećajnost", directory: MATERIAL_DIR_31_60 },
  { slug: "skromnost", title: "Skromnost i umjerenost", directory: MATERIAL_DIR_31_60 },
  { slug: "ikindija-namaz", title: "Ikindija-namaz", directory: MATERIAL_DIR_31_60 },
  { slug: "namaz-putnika", title: "Namaz putnika", directory: MATERIAL_DIR_31_60 },
  { slug: "namaz-bolesnika", title: "Namaz bolesnika", directory: MATERIAL_DIR_31_60 },
  { slug: "jacija-namaz", title: "Jacija-namaz", directory: MATERIAL_DIR_31_60 },
  { slug: "kunut-dova", title: "Učenje Kunut-dove", directory: MATERIAL_DIR_31_60 },
  { slug: "namaska-dova", title: "Namaska dova", directory: MATERIAL_DIR_31_60 },
  { slug: "el-maun", title: "Učenje sure El-Maun", directory: MATERIAL_DIR_31_60 },
  { slug: "radne-navike", title: "Razvijanje radne navike", directory: MATERIAL_DIR_31_60 },
  { slug: "srednji-put", title: "Uloga i važnost srednjeg puta", directory: MATERIAL_DIR_31_60 },
  { slug: "dzuma-namaz", title: "Džuma-namaz", directory: MATERIAL_DIR_31_60 },
  { slug: "bajram-namaz", title: "Bajram-namaz", directory: MATERIAL_DIR_31_60 },
  { slug: "el-kurejs", title: "Učenje sure El-Kurejš", directory: MATERIAL_DIR_31_60 },
  { slug: "teravih-namaz", title: "Teravih-namaz", directory: MATERIAL_DIR_31_60 },
  { slug: "istina", title: "Važnost i snaga istine", directory: MATERIAL_DIR_31_60 },
  { slug: "prevara", title: "Prevara, laž i krađa", directory: MATERIAL_DIR_31_60 },
  { slug: "ponasanje-drustvo", title: "Ponašanje u društvu", directory: MATERIAL_DIR_31_60 },
  { slug: "elif-lam-mim", title: "Elif-lām-mīm", directory: MATERIAL_DIR_31_60 },
  { slug: "mubarek-noci", title: "Važnost mubarek-noći", directory: MATERIAL_DIR_61_68 },
  { slug: "nafila", title: "Vrste nafila-namaza", directory: MATERIAL_DIR_61_68 },
  { slug: "alimi", title: "Poznati alimi u BiH", directory: MATERIAL_DIR_61_68 },
  { slug: "bih", title: "Moja domovina — Bosna i Hercegovina", directory: MATERIAL_DIR_61_68 },
  { slug: "bosanski-jezik", title: "Bosanski jezik", directory: MATERIAL_DIR_61_68 },
  { slug: "kultura", title: "Kultura i tradicija", directory: MATERIAL_DIR_61_68 },
  { slug: "bosnjak", title: "Ja sam Bošnjak/Bošnjakinja", directory: MATERIAL_DIR_61_68 },
  { slug: "lekad-dzaekum", title: "Lekad džāekum", directory: MATERIAL_DIR_61_68 },
];

export async function seedBundledNivo2FillInMaterials(): Promise<{
  inserted: number;
  skipped: number;
  missingFiles: string[];
  missingLessons: string[];
}> {
  const lessonRows = await db
    .select({ id: ilmihalLekcijeTable.id, slug: ilmihalLekcijeTable.slug })
    .from(ilmihalLekcijeTable)
    .where(inArray(ilmihalLekcijeTable.slug, NIV0_2_FILL_IN_MATERIALS.map(material => material.slug)));
  const lessonIdBySlug = new Map(lessonRows.map(lesson => [lesson.slug, lesson.id]));

  const lessonIds = lessonRows.map(lesson => lesson.id);
  const existingRows = lessonIds.length > 0
    ? await db
        .select({ lekcijaId: prilozi.lekcijaId, storedName: prilozi.storedName })
        .from(prilozi)
        .where(inArray(prilozi.lekcijaId, lessonIds))
    : [];
  const existing = new Set(existingRows.map(row => `${row.lekcijaId}:${row.storedName}`));

  const uploadsDir = process.env["UPLOADS_DIR"]
    ? path.resolve(process.env["UPLOADS_DIR"])
    : path.resolve(process.cwd(), "uploads");
  const bundledMaterialsDir = process.env["BUNDLED_TEACHING_MATERIALS_DIR"]
    ? path.resolve(process.env["BUNDLED_TEACHING_MATERIALS_DIR"])
    : uploadsDir;
  const missingFiles: string[] = [];
  const missingLessons: string[] = [];
  const rows: Array<typeof prilozi.$inferInsert> = [];
  let skipped = 0;

  for (const material of NIV0_2_FILL_IN_MATERIALS) {
    const lessonId = lessonIdBySlug.get(material.slug);
    if (!lessonId) {
      missingLessons.push(material.slug);
      continue;
    }
    const storedName = `${material.directory || MATERIAL_DIR}/${material.slug}.pdf`;
    const filePath = path.join(uploadsDir, storedName);
    const bundledFilePath = path.join(bundledMaterialsDir, storedName);
    if (!fs.existsSync(filePath) && fs.existsSync(bundledFilePath)) {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.copyFileSync(bundledFilePath, filePath);
    }
    if (!fs.existsSync(filePath)) {
      missingFiles.push(storedName);
      continue;
    }
    if (existing.has(`${lessonId}:${storedName}`)) {
      skipped++;
      continue;
    }
    rows.push({
      lekcijaId: lessonId,
      redoslijed: -1000,
      originalName: `${material.title} — popuni prazninu.pdf`,
      storedName,
      fileSize: fs.statSync(filePath).size,
      mimeType: "application/pdf",
      kind: "file",
      approved: true,
      uploadedByRole: "admin",
      uploadedByUserId: null,
      hasanatReward: 0,
    });
  }

  if (rows.length > 0) {
    await db.insert(prilozi).values(rows);
  }

  return {
    inserted: rows.length,
    skipped,
    missingFiles,
    missingLessons,
  };
}