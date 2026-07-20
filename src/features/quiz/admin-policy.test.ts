import { describe, expect, it } from "vitest";
import { MAX_QUIZ_TOTAL_POINTS } from "@/constants/quiz";
import { canAddQuizPoints } from "./admin-policy";

describe("quiz total points policy", () => {
  it("accepts the exact database max_score boundary", () => {
    expect(canAddQuizPoints(MAX_QUIZ_TOTAL_POINTS - 100_000, 100_000)).toBe(true);
  });

  it("rejects a placement that would exceed the database max_score boundary", () => {
    expect(canAddQuizPoints(MAX_QUIZ_TOTAL_POINTS, 1)).toBe(false);
    expect(canAddQuizPoints(MAX_QUIZ_TOTAL_POINTS - 99_999, 100_000)).toBe(false);
  });

  it("rejects invalid counters", () => {
    expect(canAddQuizPoints(-1, 1)).toBe(false);
    expect(canAddQuizPoints(0.5, 1)).toBe(false);
  });
});
