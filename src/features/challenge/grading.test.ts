import { describe, expect, it } from "vitest";
import { resolveChallengeAttempt } from "./grading";

describe("resolveChallengeAttempt", () => {
  it("completes a correct flag challenge and applies only earlier wrong-attempt penalties", () => {
    expect(
      resolveChallengeAttempt({
        points: 100,
        penaltyPerWrongAttempt: 15,
        previousWrongAttempts: 2,
        requiresCorrectFlag: true,
        flagCorrect: true,
      }),
    ).toEqual({ completed: true, nextWrongAttempts: 2, score: 70 });
  });

  it("records an incorrect flag without awarding points", () => {
    expect(
      resolveChallengeAttempt({
        points: 100,
        penaltyPerWrongAttempt: 10,
        previousWrongAttempts: 1,
        requiresCorrectFlag: true,
        flagCorrect: false,
      }),
    ).toEqual({ completed: false, nextWrongAttempts: 2, score: 0 });
  });

  it("completes a writeup-only challenge and never returns a negative score", () => {
    expect(
      resolveChallengeAttempt({
        points: 20,
        penaltyPerWrongAttempt: 50,
        previousWrongAttempts: 1,
        requiresCorrectFlag: false,
        flagCorrect: false,
      }),
    ).toEqual({ completed: true, nextWrongAttempts: 1, score: 0 });
  });
});
