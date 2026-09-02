export const H5P_CORRECT_RETRY_LOCK_MS = 48 * 60 * 60 * 1000;

export function rewardCapForAttempt(attemptNo: number): number {
  if (attemptNo <= 1) return 5;
  if (attemptNo === 2) return 3;
  return 0;
}

export function multiplierForAttempt(attemptNo: number): number {
  return rewardCapForAttempt(attemptNo) / rewardCapForAttempt(1);
}

export function lockUntilForAttempt(completedAt: Date, procenat: number): Date | null {
  if (procenat < 100) return null;
  return new Date(completedAt.getTime() + H5P_CORRECT_RETRY_LOCK_MS);
}