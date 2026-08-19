import type { PauseConfig, PauseProgress } from "./lesson-pause";

export function normalizePauseProgress(
  config: PauseConfig,
  progress: PauseProgress | undefined,
): PauseProgress | undefined {
  if (!progress) return undefined;

  if (config.type === "yes-no") {
    return progress.submitted && typeof progress.answer === "boolean" ? progress : undefined;
  }

  if (config.type === "multiple-choice" || config.type === "fact-question") {
    return progress.submitted &&
      Number.isInteger(progress.answer) &&
      (progress.answer as number) >= 0 &&
      (progress.answer as number) < config.options.length
      ? progress
      : undefined;
  }

  if (config.type === "matching") {
    if (!progress.answer || typeof progress.answer !== "object" || Array.isArray(progress.answer)) {
      return undefined;
    }
    const answer = progress.answer as Record<string, unknown>;
    const allowedRights = new Set(config.pairs.map((pair) => pair.right));
    const cleaned = Object.fromEntries(Object.entries(answer).filter(([index, value]) => {
      const numericIndex = Number(index);
      return Number.isInteger(numericIndex) &&
        numericIndex >= 0 &&
        numericIndex < config.pairs.length &&
        typeof value === "string" &&
        allowedRights.has(value);
    }));
    if (progress.submitted && Object.keys(cleaned).length !== config.pairs.length) return undefined;
    return { ...progress, answer: cleaned };
  }

  if (!Array.isArray(progress.answer) || progress.answer.length !== config.items.length) {
    return undefined;
  }
  const expected = [...config.items].sort();
  const actual = progress.answer.every((item) => typeof item === "string")
    ? [...progress.answer as string[]].sort()
    : [];
  return expected.every((item, index) => item === actual[index]) ? progress : undefined;
}

export function mergePauseProgress(
  current: Record<string, PauseProgress> | undefined,
  pauseId: string,
  progress: PauseProgress,
): Record<string, PauseProgress> {
  return {
    ...(current ?? {}),
    [pauseId]: { ...(current?.[pauseId] ?? {}), ...progress },
  };
}