import { describe, expect, it } from "vitest";
import { scoreChoiceAnswer, shouldReleaseQuizResult } from "./grading";

const choices = [
  { id: "a", isCorrect: true },
  { id: "b", isCorrect: true },
  { id: "c", isCorrect: false },
];

describe("quiz grading", () => {
  it("scores single and multiple choice answers with bounded partial credit", () => {
    expect(scoreChoiceAnswer({ type: "SINGLE_CHOICE", selectedChoiceIds: ["a"], choices, points: 10 })).toBe(10);
    expect(scoreChoiceAnswer({ type: "SINGLE_CHOICE", selectedChoiceIds: ["c"], choices, points: 10 })).toBe(0);
    expect(scoreChoiceAnswer({ type: "MULTIPLE_CHOICE", selectedChoiceIds: ["a"], choices, points: 10 })).toBe(5);
    expect(scoreChoiceAnswer({ type: "MULTIPLE_CHOICE", selectedChoiceIds: ["a", "c"], choices, points: 10 })).toBe(0);
    expect(scoreChoiceAnswer({ type: "MULTIPLE_CHOICE", selectedChoiceIds: ["a", "b"], choices, points: 10 })).toBe(10);
  });

  it("rejects malformed choice identifiers", () => {
    expect(scoreChoiceAnswer({ type: "SINGLE_CHOICE", selectedChoiceIds: [], choices, points: 10 })).toBeNull();
    expect(scoreChoiceAnswer({ type: "SINGLE_CHOICE", selectedChoiceIds: ["a", "b"], choices, points: 10 })).toBeNull();
    expect(scoreChoiceAnswer({ type: "MULTIPLE_CHOICE", selectedChoiceIds: ["a", "a"], choices, points: 10 })).toBeNull();
    expect(scoreChoiceAnswer({ type: "MULTIPLE_CHOICE", selectedChoiceIds: ["unknown"], choices, points: 10 })).toBeNull();
  });

  it("enforces each result release policy", () => {
    const deadline = new Date("2026-07-20T10:00:00Z");
    const before = new Date("2026-07-20T09:59:59Z");
    const after = new Date("2026-07-20T10:00:01Z");

    expect(shouldReleaseQuizResult({ policy: "HIDDEN", deadline, status: "GRADED", now: after })).toBe(false);
    expect(shouldReleaseQuizResult({ policy: "IMMEDIATE", deadline, status: "SUBMITTED", now: before })).toBe(false);
    expect(shouldReleaseQuizResult({ policy: "IMMEDIATE", deadline, status: "GRADED", now: before })).toBe(true);
    expect(shouldReleaseQuizResult({ policy: "AFTER_DEADLINE", deadline, status: "SUBMITTED", now: before })).toBe(false);
    expect(shouldReleaseQuizResult({ policy: "AFTER_DEADLINE", deadline, status: "SUBMITTED", now: after })).toBe(false);
    expect(shouldReleaseQuizResult({ policy: "AFTER_DEADLINE", deadline, status: "GRADED", now: after })).toBe(true);
    expect(shouldReleaseQuizResult({ policy: "AFTER_GRADING", deadline, status: "AUTO_SUBMITTED", now: after })).toBe(false);
    expect(shouldReleaseQuizResult({ policy: "AFTER_GRADING", deadline, status: "GRADED", now: before })).toBe(true);
    expect(shouldReleaseQuizResult({ policy: "AFTER_DEADLINE", deadline, status: "IN_PROGRESS", now: after })).toBe(false);
  });
});
