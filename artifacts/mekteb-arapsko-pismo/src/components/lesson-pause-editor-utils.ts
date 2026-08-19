export function correctOptionAfterRemoval(
  correctOption: number,
  removedOption: number,
  remainingOptions: number,
): number {
  if (remainingOptions <= 0) return 0;
  if (removedOption < correctOption) return correctOption - 1;
  if (removedOption === correctOption) {
    return Math.min(removedOption, remainingOptions - 1);
  }
  return correctOption;
}