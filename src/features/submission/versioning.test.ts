import { describe, expect, it } from "vitest";
import { getNextSubmissionVersion, hasSubmissionVersionConflict } from "./versioning";

describe("submission versioning", () => {
  it("starts at version one and increments without overwriting", () => {
    expect(getNextSubmissionVersion(0)).toBe(1);
    expect(getNextSubmissionVersion(3)).toBe(4);
  });

  it("detects a concurrent save based on the loaded version", () => {
    expect(hasSubmissionVersionConflict(3, 3)).toBe(false);
    expect(hasSubmissionVersionConflict(4, 3)).toBe(true);
  });

  it("rejects invalid counters", () => {
    expect(() => getNextSubmissionVersion(-1)).toThrow("INVALID_SUBMISSION_VERSION");
    expect(() => getNextSubmissionVersion(1.5)).toThrow("INVALID_SUBMISSION_VERSION");
  });
});
