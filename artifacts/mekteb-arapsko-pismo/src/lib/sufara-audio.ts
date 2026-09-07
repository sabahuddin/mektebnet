import {
  canPlaySufaraAudio,
  getSufaraAudioApproval,
  getSufaraAudioUrl,
} from "@/data/audio-approval";

const BASE = import.meta.env.BASE_URL;

export interface SufaraPlaybackResult {
  played: boolean;
  reason: "playing" | "missing" | "needs_review" | "rejected";
}

export function playSufaraAudio(file: string, adminPreview = false): SufaraPlaybackResult {
  const approval = getSufaraAudioApproval(file);
  if (!approval) return { played: false, reason: "missing" };
  if (approval.status === "rejected") return { played: false, reason: "rejected" };
  if (!canPlaySufaraAudio(file, adminPreview)) {
    return { played: false, reason: "needs_review" };
  }

  const url = getSufaraAudioUrl(file, BASE);
  if (!url) return { played: false, reason: "missing" };
  const audio = new Audio(url);
  audio.play().catch(() => {});
  return { played: true, reason: "playing" };
}

