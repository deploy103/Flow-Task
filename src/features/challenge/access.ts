export type ChallengeAttemptAccessReason =
  | "ALLOWED"
  | "NOT_TARGET"
  | "NOT_OPEN"
  | "CLOSED"
  | "COMPLETED"
  | "ATTEMPT_LIMIT";

export function getChallengeAttemptAccess(input: {
  canSubmit: boolean;
  opensAt: Date;
  deadline: Date;
  allowLate: boolean;
  completedAt?: Date | null;
  attemptsCount: number;
  maxAttempts?: number | null;
  now?: Date;
}): ChallengeAttemptAccessReason {
  const now = input.now ?? new Date();
  if (!input.canSubmit) return "NOT_TARGET";
  if (now < input.opensAt) return "NOT_OPEN";
  if (now > input.deadline && !input.allowLate) return "CLOSED";
  if (input.completedAt) return "COMPLETED";
  if (input.maxAttempts !== null && input.maxAttempts !== undefined) {
    if (input.attemptsCount >= input.maxAttempts) return "ATTEMPT_LIMIT";
  }
  return "ALLOWED";
}
