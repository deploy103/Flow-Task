export function getQuizAttemptState(input: {
  canSubmit: boolean;
  opensAt: Date;
  deadline: Date;
  allowLate: boolean;
  attemptsUsed: number;
  attemptLimit: number;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  if (!input.canSubmit) return "NOT_TARGET" as const;
  if (now < input.opensAt) return "NOT_OPEN" as const;
  if (now > input.deadline && !input.allowLate) return "CLOSED" as const;
  if (input.attemptsUsed >= input.attemptLimit) return "ATTEMPT_LIMIT" as const;
  return "ALLOWED" as const;
}

export function isQuizAttemptExpired(expiresAt: Date | null, now = new Date()) {
  return expiresAt !== null && now >= expiresAt;
}

export function shuffleValues<T>(values: readonly T[], random: () => number = Math.random) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}
