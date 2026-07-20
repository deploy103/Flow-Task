import { describe, expect, it } from "vitest";
import { getQuizAttemptState, isQuizAttemptExpired, shuffleValues } from "./attempt-policy";

const opensAt = new Date("2026-07-20T09:00:00Z");
const deadline = new Date("2026-07-20T10:00:00Z");

describe("quiz attempt policy", () => {
  it("checks targeting, open time, deadline, and attempt count", () => {
    const base = { canSubmit: true, opensAt, deadline, allowLate: false, attemptsUsed: 0, attemptLimit: 2, now: new Date("2026-07-20T09:30:00Z") };
    expect(getQuizAttemptState(base)).toBe("ALLOWED");
    expect(getQuizAttemptState({ ...base, canSubmit: false })).toBe("NOT_TARGET");
    expect(getQuizAttemptState({ ...base, now: new Date("2026-07-20T08:59:59Z") })).toBe("NOT_OPEN");
    expect(getQuizAttemptState({ ...base, now: new Date("2026-07-20T10:00:01Z") })).toBe("CLOSED");
    expect(getQuizAttemptState({ ...base, attemptsUsed: 2 })).toBe("ATTEMPT_LIMIT");
    expect(getQuizAttemptState({ ...base, allowLate: true, now: new Date("2026-07-21T10:00:00Z") })).toBe("ALLOWED");
  });

  it("treats the exact expiry instant as expired", () => {
    expect(isQuizAttemptExpired(null, deadline)).toBe(false);
    expect(isQuizAttemptExpired(deadline, new Date(deadline.getTime() - 1))).toBe(false);
    expect(isQuizAttemptExpired(deadline, deadline)).toBe(true);
  });

  it("shuffles a copy while preserving every value", () => {
    const source = ["a", "b", "c", "d"];
    const shuffled = shuffleValues(source, () => 0);
    expect(source).toEqual(["a", "b", "c", "d"]);
    expect(shuffled).not.toBe(source);
    expect([...shuffled].sort()).toEqual([...source].sort());
  });
});
