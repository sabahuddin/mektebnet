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
  status: "needs_review",
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
        ? "OpenAI gpt-4o-mini-tts kandidat (AI glas)"
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
