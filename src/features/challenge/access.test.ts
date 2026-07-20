import { describe, expect, it } from "vitest";
import { getChallengeAttemptAccess } from "./access";

const baseInput = {
  canSubmit: true,
  opensAt: new Date("2026-07-20T00:00:00.000Z"),
  deadline: new Date("2026-07-21T00:00:00.000Z"),
  allowLate: false,
  completedAt: null,
  attemptsCount: 0,
  maxAttempts: null,
  now: new Date("2026-07-20T12:00:00.000Z"),
};

describe("getChallengeAttemptAccess", () => {
  it("allows an eligible member during the assignment window", () => {
    expect(getChallengeAttemptAccess(baseInput)).toBe("ALLOWED");
  });

  it("rejects non-targets and attempts before publication", () => {
    expect(getChallengeAttemptAccess({ ...baseInput, canSubmit: false })).toBe("NOT_TARGET");
    expect(
      getChallengeAttemptAccess({ ...baseInput, now: new Date("2026-07-19T23:59:59.999Z") }),
    ).toBe("NOT_OPEN");
  });

  it("enforces the deadline unless late submissions are enabled", () => {
    const afterDeadline = new Date("2026-07-21T00:00:00.001Z");
    expect(getChallengeAttemptAccess({ ...baseInput, now: afterDeadline })).toBe("CLOSED");
    expect(
      getChallengeAttemptAccess({ ...baseInput, now: afterDeadline, allowLate: true }),
    ).toBe("ALLOWED");
  });

  it("prevents attempts after completion or after reaching the configured limit", () => {
    expect(
      getChallengeAttemptAccess({ ...baseInput, completedAt: new Date("2026-07-20T11:00:00Z") }),
    ).toBe("COMPLETED");
    expect(getChallengeAttemptAccess({ ...baseInput, attemptsCount: 3, maxAttempts: 3 })).toBe(
      "ATTEMPT_LIMIT",
    );
  });
});
