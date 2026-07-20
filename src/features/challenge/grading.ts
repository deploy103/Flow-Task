export type ChallengeAttemptResult = {
  completed: boolean;
  nextWrongAttempts: number;
  score: number;
};

export function resolveChallengeAttempt(input: {
  points: number;
  penaltyPerWrongAttempt: number;
  previousWrongAttempts: number;
  requiresCorrectFlag: boolean;
  flagCorrect: boolean;
}): ChallengeAttemptResult {
  if (input.requiresCorrectFlag && !input.flagCorrect) {
    return {
      completed: false,
      nextWrongAttempts: input.previousWrongAttempts + 1,
      score: 0,
    };
  }

  return {
    completed: true,
    nextWrongAttempts: input.previousWrongAttempts,
    score: Math.max(
      0,
      input.points - input.previousWrongAttempts * input.penaltyPerWrongAttempt,
    ),
  };
}
