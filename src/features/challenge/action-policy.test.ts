import { describe, expect, it } from "vitest";
import {
  getChallengeAccessError,
  hasChallengeSubmissionMethod,
  resolveChallengeSubmissionValues,
} from "./action-policy";

describe("challenge action policy", () => {
  it("requires at least one configured submission method", () => {
    expect(
      hasChallengeSubmissionMethod({ flag: "", requireWriteup: false, requireWriteupUrl: false }),
    ).toBe(false);
    expect(
      hasChallengeSubmissionMethod({
        flag: "DH{answer}",
        requireWriteup: false,
        requireWriteupUrl: false,
      }),
    ).toBe(true);
    expect(
      hasChallengeSubmissionMethod({ flag: null, requireWriteup: true, requireWriteupUrl: false }),
    ).toBe(true);
  });

  it("maps access decisions to stable redirect errors", () => {
    expect(getChallengeAccessError("NOT_TARGET")).toBe("not_target");
    expect(getChallengeAccessError("NOT_OPEN")).toBe("not_open");
    expect(getChallengeAccessError("CLOSED")).toBe("closed");
    expect(getChallengeAccessError("COMPLETED")).toBe("already_completed");
    expect(getChallengeAccessError("ATTEMPT_LIMIT")).toBe("attempt_limit");
  });

  it("requires a new flag while preserving previously submitted optional writeup fields", () => {
    expect(
      resolveChallengeSubmissionValues({
        requiresCorrectFlag: true,
        requireWriteup: true,
        requireWriteupUrl: true,
        submittedFlag: "  ",
        existingWriteup: "기존 풀이",
        existingWriteupUrl: "https://example.com/writeup",
      }),
    ).toEqual({ success: false, error: "flag_required" });

    expect(
      resolveChallengeSubmissionValues({
        requiresCorrectFlag: true,
        requireWriteup: true,
        requireWriteupUrl: true,
        submittedFlag: "DH{answer}",
        existingWriteup: "기존 풀이",
        existingWriteupUrl: "https://example.com/writeup",
      }),
    ).toEqual({
      success: true,
      data: {
        flag: "DH{answer}",
        writeup: "기존 풀이",
        writeupUrl: "https://example.com/writeup",
      },
    });
  });

  it("rejects missing required writeup content and URL", () => {
    expect(
      resolveChallengeSubmissionValues({
        requiresCorrectFlag: false,
        requireWriteup: true,
        requireWriteupUrl: false,
      }),
    ).toEqual({ success: false, error: "writeup_required" });
    expect(
      resolveChallengeSubmissionValues({
        requiresCorrectFlag: false,
        requireWriteup: false,
        requireWriteupUrl: true,
      }),
    ).toEqual({ success: false, error: "writeup_url_required" });
  });
});
