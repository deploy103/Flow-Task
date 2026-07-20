import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { hashChallengeFlag } from "@/features/challenge/flag";
import { hashQuizAnswer, matchesQuizAnswer, normalizeQuizAnswer } from "./answer-hash";

const pepper = "quiz-test-pepper-value-at-least-32-characters";
const options = { caseSensitive: false, trimWhitespace: true, pepper };

describe("quiz answer hashing", () => {
  it("stores a domain-separated HMAC digest rather than the raw answer", () => {
    const answer = "FLOW{private-answer}";
    const digest = hashQuizAnswer(answer, { ...options, caseSensitive: true });
    const expected = createHmac("sha256", pepper)
      .update("flow-task/quiz-answer/v1\0")
      .update(answer)
      .digest("hex");

    expect(digest).toBe(expected);
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
    expect(digest).not.toContain(answer);
    expect(digest).not.toBe(hashChallengeFlag(answer, { ...options, caseSensitive: true }));
  });

  it("normalizes and verifies answers using the configured policy", () => {
    const digest = hashQuizAnswer("  FlOw{Mixed} \n", options);

    expect(normalizeQuizAnswer("  FlOw{Mixed} \n", options)).toBe("flow{mixed}");
    expect(matchesQuizAnswer("FLOW{MIXED}", [digest], options)).toBe(true);
    expect(matchesQuizAnswer("wrong", [digest], options)).toBe(false);
    expect(matchesQuizAnswer("FLOW{MIXED}", ["invalid", digest], options)).toBe(true);
  });

  it("rejects empty answers and a missing or weak pepper", () => {
    expect(() => hashQuizAnswer(" \n ", options)).toThrow(/EMPTY/);
    expect(() => hashQuizAnswer("answer", { ...options, pepper: "short" })).toThrow(/PEPPER/);
  });
});
