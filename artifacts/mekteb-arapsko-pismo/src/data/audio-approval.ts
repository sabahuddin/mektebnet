import { SLOGOVI_AUDIO } from "@/data/slogovi-mapping";

export type SufaraAudioStatus = "draft" | "needs_review" | "approved" | "rejected";
export type SufaraAudioKind = "harf" | "hareket" | "slog" | "sukun" | "tesdid" | "tenvin";

export interface SufaraAudioApproval {
  file: string;
  arabic: string | null;
  kind: SufaraAudioKind;
  reciter: string | null;
  reviewer: string | null;
  qiraah: "Hafs od Asima" | null;
  status: SufaraAudioStatus;
  reviewedAt: string | null;
  source: string;
  sourceUrl: string | null;
  license: string | null;
  folder: "harfovi" | "slogovi";
}

// Ovi fajlovi su pronađeni u staroj razvojnoj verziji projekta bez pratećeg
// zapisnika o učaču, kiraetu i stručnoj provjeri. Zato namjerno nisu označeni
// kao odobreni, iako tehnički mogu biti preslušani u administratorskom pregledu.
const LEGACY_HARF_FILES = [
  "ajn.mp3", "ba.mp3", "dad.mp3", "dal.mp3", "dzim.mp3", "elif.mp3",
  "fa.mp3", "gajn.mp3", "ha.mp3", "ha2.mp3", "he.mp3", "ja.mp3",
  "kaf.mp3", "kef.mp3", "lam.mp3", "mim.mp3", "nun.mp3", "ra.mp3",
  "sa.mp3", "sad.mp3", "sin.mp3", "sin2.mp3", "ta.mp3", "ta2.mp3",
  "waw.mp3", "za.mp3", "zal.mp3", "zejn.mp3",
] as const;

const LEGACY_HAREKET_FILES: Array<{ file: string; arabic: string; kind: SufaraAudioKind }> = [
  { file: "hareke-fatha.mp3", arabic: "ـَ", kind: "hareket" },
  { file: "hareke-kasra.mp3", arabic: "ـِ", kind: "hareket" },
  { file: "hareke-damma.mp3", arabic: "ـُ", kind: "hareket" },
  { file: "hareke-sukun.mp3", arabic: "ـْ", kind: "sukun" },
  { file: "hareke-sedda.mp3", arabic: "ـّ", kind: "tesdid" },
];

// Snimci koje je pokvareni generator ostavio neupotrebljivim. Provjereno
// mjerenjem, a ne na oko: skripta `skrati-preduge-zvukove.mjs` preslušala je
// svaki od njih ffmpegom.
//
// Generator nije imao ograničenje dužine, pa je model umjesto kratkog izgovora
// znao otići u petlju; 258 snimaka ima tačno 13 min 39 s, koliko je model
// stigao izgovoriti prije serverskog ograničenja.
//
// Dok se ne snime iznova, stoje kao „rejected" da ih `canPlaySufaraAudio` ne
// pusti djetetu ni u administratorskom pregledu.

// Nemaju nijednog zvuka iznad praga čujnosti — trinaest minuta tišine.
const SNIMCI_BEZ_ZVUKA = [
  "03f53501af6d.mp3", "0a2870b26538.mp3", "21d425f32ec0.mp3", "3e77d3a9887f.mp3",
  "4013eb9c404c.mp3", "4d4927969385.mp3", "6e3edd51c023.mp3", "6ea953abf8e2.mp3",
  "8d0c80506ed6.mp3", "90ab054b8996.mp3", "bd3990239c25.mp3", "c96bf4bf94b6.mp3",
  "ea09860d1971.mp3", "openai-ajn-damma.mp3", "openai-ajn-fetha.mp3", "openai-ajn-kesra.mp3",
  "openai-fa-damma.mp3", "openai-fa-fetha.mp3", "openai-gajn-kesra.mp3", "openai-he-fetha.mp3",
  "openai-he-kesra.mp3", "openai-ja-damma.mp3", "openai-ja-fetha.mp3", "openai-ja-kesra.mp3",
  "openai-kaf-fetha.mp3", "openai-kaf-kesra.mp3", "openai-kataba.mp3", "openai-kef-damma.mp3",
  "openai-kef-fetha.mp3", "openai-mim-kesra.mp3", "openai-nun-damma.mp3",
  "openai-nun-fetha.mp3", "openai-nun-sukun.mp3", "openai-ra-damma.mp3", "openai-ra-fetha.mp3",
  "openai-rata.mp3", "openai-reading-623-64e-623-64e-623-64e.mp3",
  "openai-reading-623-64e-623-64e.mp3", "openai-reading-623-64e-623-64f-623-64e.mp3",
  "openai-reading-623-64e-623-64f-625-650.mp3", "openai-reading-623-64e-623-64f.mp3",
  "openai-reading-623-64e-625-650-623-64e.mp3", "openai-reading-623-64e-625-650-623-64f.mp3",
  "openai-reading-623-64e-625-650.mp3", "openai-reading-623-64e-62c-650.mp3",
  "openai-reading-623-64e-631-652.mp3", "openai-reading-623-64f-623-64e-625-650.mp3",
  "openai-reading-623-64f-623-64e.mp3", "openai-reading-623-64f-623-64f-623-64f.mp3",
  "openai-reading-623-64f-623-64f.mp3", "openai-reading-623-64f-625-650.mp3",
  "openai-reading-625-650-623-64e-623-64f.mp3", "openai-reading-625-650-623-64e-625-650.mp3",
  "openai-reading-625-650-623-64f-623-64e.mp3", "openai-reading-625-650-623-64f-625-650.mp3",
  "openai-reading-625-650-623-64f.mp3", "openai-reading-625-650-625-650.mp3",
  "openai-reading-62a-64f-628-650-62b-64e.mp3", "openai-reading-62a-650-62c-64f.mp3",
  "openai-reading-62c-64f-628-652.mp3", "openai-reading-62d-64f-635-650-631-64e.mp3",
  "openai-reading-630-64e-631-652.mp3", "openai-reading-632-64e-628-64e.mp3",
  "openai-reading-632-64e-628-651-64e.mp3", "openai-reading-632-64e-62f-652.mp3",
  "openai-reading-632-64f-631-652.mp3", "openai-reading-633-64f-631-650-631-64e.mp3",
  "openai-reading-634-64e-62f-651-64e.mp3", "openai-reading-635-64e-637-64e.mp3",
  "openai-reading-637-64e-635-64e.mp3", "openai-reading-641-64e-642-64e-62f-64e.mp3",
  "openai-reading-643-64e-645-652.mp3", "openai-reading-647-64e-631-64e-628-64e.mp3",
  "openai-sad-damma.mp3", "openai-sad-fetha.mp3", "openai-sad-kesra.mp3", "openai-shakara.mp3",
  "openai-shin-damma.mp3", "openai-shin-fetha.mp3", "openai-shin-kesra.mp3",
  "openai-sin-damma.mp3", "openai-sin-fetha.mp3", "openai-sin-kesra.mp3",
  "openai-sin-sukun.mp3", "openai-sukun-ab.mp3", "openai-sukun-hum.mp3",
  "openai-sukun-kun.mp3", "openai-sukun-min.mp3", "openai-ta-heavy-fetha.mp3",
  "openai-ta-heavy-kesra.mp3", "openai-tenvin-ajn-un.mp3", "openai-tenvin-fa-un.mp3",
  "openai-tenvin-gajn-in.mp3", "openai-tenvin-han.mp3", "openai-tenvin-he-in.mp3",
  "openai-tenvin-ja-in.mp3", "openai-tenvin-khan.mp3", "openai-tenvin-mim-un.mp3",
  "openai-tenvin-tan.mp3", "openai-tenvin-thun.mp3", "openai-tenvin-tin.mp3",
  "openai-tenvin-tun.mp3", "openai-tenvin-zin.mp3", "openai-tesdid-abbu.mp3",
  "openai-tesdid-ahha-he.mp3", "openai-tesdid-ajji.mp3", "openai-tesdid-akhi.mp3",
  "openai-tesdid-ashsha.mp3", "openai-tesdid-assaad.mp3", "openai-tesdid-aththu.mp3",
  "openai-tesdid-inna.mp3", "openai-tesdid-radda.mp3", "openai-vav-damma.mp3",
  "openai-vav-kesra.mp3", "openai-yadun.mp3", "openai-za-heavy-kesra.mp3",
  "openai-zal-damma.mp3", "openai-zal-fetha.mp3", "openai-zal-kesra.mp3",
  "openai-zejn-damma.mp3", "openai-zejn-fetha.mp3", "openai-zejn-kesra.mp3",
] as const;

// Imaju govora, ali predugo i bez jasnog kraja izgovora, pa se iz njih ne da
// izrezati jedan slog. Neki govore punih trinaest minuta bez prestanka.
const SNIMCI_PREDUGOG_GOVORA = [
  "68515c9cd644.mp3", "730b59451d48.mp3", "84d7dc8ded0e.mp3", "openai-baatha.mp3",
  "openai-bada.mp3", "openai-baraza.mp3", "openai-bashara.mp3", "openai-batasha.mp3",
  "openai-dad-damma.mp3", "openai-dakhala.mp3", "openai-dal-damma.mp3", "openai-dal-fetha.mp3",
  "openai-daraja.mp3", "openai-dhabaha.mp3", "openai-hajara.mp3", "openai-hamala.mp3",
  "openai-harasa.mp3", "openai-hasada.mp3", "openai-jaala.mp3", "openai-jaza.mp3",
  "openai-kallama.mp3", "openai-kef-kesra.mp3", "openai-kharaja.mp3", "openai-lam-damma.mp3",
  "openai-mim-damma.mp3", "openai-mim-sukun.mp3", "openai-rajaba.mp3",
  "openai-reading-623-64e-62c-650-628-64f.mp3", "openai-reading-628-64e-630-64e-631-64e.mp3",
  "openai-reading-628-64e-632-64e-631-64e.mp3", "openai-reading-628-64f-639-650-62b-64e.mp3",
  "openai-reading-628-650-631-652.mp3", "openai-reading-62a-64e-628-64f.mp3",
  "openai-reading-62a-64f-62e-650-628-64e.mp3", "openai-reading-62c-64e-631-64e-62d-64e.mp3",
  "openai-reading-62c-64f-628-650.mp3", "openai-reading-62d-64e-630-650-631-64e.mp3",
  "openai-reading-62d-64e-631-64e-62b-64e.mp3", "openai-reading-62d-64e-631-64e-632-64e.mp3",
  "openai-reading-62d-64e-635-64e-62f-64e.mp3", "openai-reading-62d-64e-635-64e-631-64e.mp3",
  "openai-reading-62d-64e-635-651-64e.mp3", "openai-reading-62d-64e-637-64e.mp3",
  "openai-reading-62e-64f-630-652.mp3", "openai-reading-62f-64e-631-64e-633-64e.mp3",
  "openai-reading-631-64e-62d-650-645-64e.mp3", "openai-reading-633-64e-628-64e-62d-64e.mp3",
  "openai-reading-634-64e-631-64e-62d-64e.mp3", "openai-reading-635-64e-62d-651-64e.mp3",
  "openai-reading-637-64f-631-650-62f-64e.mp3", "openai-reading-639-64e-628-64e-631-64e.mp3",
  "openai-reading-63a-64e-631-651-64e.mp3", "openai-reading-641-64e-62c-64e-631-64e.mp3",
  "openai-reading-641-64e-631-64e-63a-64e.mp3", "openai-reading-641-64e-642-64e-631-64e.mp3",
  "openai-reading-642-64e-630-64e-641-64e.mp3", "openai-reading-642-64e-637-64e-639-64e.mp3",
  "openai-reading-647-64e-62f-64e-645-64e.mp3", "openai-sabara.mp3", "openai-samia.mp3",
  "openai-shara.mp3", "openai-sukun-hab.mp3", "openai-ta-heavy-damma.mp3",
  "openai-tabakha.mp3", "openai-tara.mp3", "openai-tenvin-kef-un.mp3",
  "openai-tenvin-ta-heavy-un.mp3", "openai-tenvin-thin.mp3", "openai-tesdid-affa.mp3",
  "openai-tesdid-ajju.mp3", "openai-tesdid-akka-kef.mp3", "openai-tesdid-assa.mp3",
  "openai-tesdid-baththa.mp3", "openai-tesdid-kharra.mp3", "openai-vav-fetha.mp3",
  "openai-zaja.mp3",
] as const;

const NEISPRAVNI_SNIMCI = new Set<string>([
  ...SNIMCI_BEZ_ZVUKA,
  ...SNIMCI_PREDUGOG_GOVORA,
]);

const legacyRecord = (
  file: string,
  folder: "harfovi" | "slogovi",
  arabic: string | null,
  kind: SufaraAudioKind,
  source: string,
): SufaraAudioApproval => ({
  file,
  arabic,
  kind,
  reciter: null,
  reviewer: null,
  qiraah: null,
  status: NEISPRAVNI_SNIMCI.has(file) ? "rejected" : "needs_review",
  reviewedAt: null,
  source,
  sourceUrl: null,
  license: null,
  folder,
});

export const SUFARA_AUDIO_APPROVALS: SufaraAudioApproval[] = [
  ...LEGACY_HARF_FILES.map((file) =>
    legacyRecord(file, "harfovi", null, "harf", "Naslijeđeni razvojni snimak"),
  ),
  ...LEGACY_HAREKET_FILES.map(({ file, arabic, kind }) =>
    legacyRecord(file, "harfovi", arabic, kind, "Naslijeđeni razvojni snimak"),
  ),
  ...Object.entries(SLOGOVI_AUDIO).map(([arabic, file]) =>
    legacyRecord(
      file,
      "slogovi",
      arabic,
      "slog",
      file.startsWith("openai-")
        ? "OpenAI gpt-audio kandidat (AI glas)"
        : "Razvojni ElevenLabs snimak (Anas, multilingual_v2)",
    ),
  ),
];

const approvalByFile = new Map(SUFARA_AUDIO_APPROVALS.map((record) => [record.file, record]));

export function getSufaraAudioApproval(file: string): SufaraAudioApproval | null {
  return approvalByFile.get(file) ?? null;
}

export function getSufaraAudioSummary() {
  return SUFARA_AUDIO_APPROVALS.reduce<Record<SufaraAudioStatus, number>>(
    (summary, record) => {
      summary[record.status] += 1;
      return summary;
    },
    { draft: 0, needs_review: 0, approved: 0, rejected: 0 },
  );
}

export function canPlaySufaraAudio(file: string, adminPreview = false): boolean {
  const record = getSufaraAudioApproval(file);
  if (!record || record.status === "rejected") return false;
  return record.status === "approved" || adminPreview;
}

export function getSufaraAudioUrl(file: string, basePath: string): string | null {
  const record = getSufaraAudioApproval(file);
  return record ? `${basePath}audio/${record.folder}/${record.file}` : null;
}
