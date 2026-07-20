import { ChallengeCategory, ExternalChallengeSource } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  MAX_CHALLENGE_ATTEMPTS,
  MAX_CHALLENGE_DESCRIPTION_LENGTH,
  MAX_CHALLENGE_FLAG_LENGTH,
  MAX_CHALLENGE_POINTS,
  MAX_CHALLENGE_TITLE_LENGTH,
  MAX_CHALLENGE_URL_LENGTH,
  MAX_CHALLENGE_WRITEUP_LENGTH,
} from "@/constants/challenge";
import {
  createExternalChallengeSchema,
  normalizeSafeHttpsUrl,
  safeHttpsUrlSchema,
  submitChallengeSchema,
} from "./schemas";

const organizationId = "fd7736d1-ecc0-4c23-b12c-84077b66dca4";
const assignmentId = "1514b9bb-6097-48ce-8362-814cb5150f24";
const itemId = "a1a44062-e81c-47ef-b7ca-423adaf083b9";

const validCreateInput = {
  organizationId,
  assignmentId,
  source: ExternalChallengeSource.DREAMHACK,
  platform: "DreamHack",
  title: "rev-basic-0",
  description: "문제를 분석하고 플래그를 제출하세요.",
  problemUrl: "https://dreamhack.io/wargame/challenges/14",
  category: ChallengeCategory.REVERSING,
  difficulty: "Level 1",
  points: "100",
  flag: "DH{correct_flag}",
  flagFormat: "DH{...}",
  caseSensitive: "on",
  trimWhitespace: "on",
  maxAttempts: "5",
  penaltyPerWrongAttempt: "10",
  requireWriteup: null,
  requireWriteupUrl: "false",
};

describe("external challenge schemas", () => {
  it("parses a valid form and normalizes booleans, numbers, text, and URLs", () => {
    const result = createExternalChallengeSchema.parse({
      ...validCreateInput,
      platform: "  DreamHack  ",
      problemUrl: " HTTPS://DREAMHACK.IO/wargame/challenges/14 ",
    });

    expect(result.platform).toBe("DreamHack");
    expect(result.problemUrl).toBe("https://dreamhack.io/wargame/challenges/14");
    expect(result.points).toBe(100);
    expect(result.maxAttempts).toBe(5);
    expect(result.caseSensitive).toBe(true);
    expect(result.trimWhitespace).toBe(true);
    expect(result.requireWriteup).toBe(false);
    expect(result.requireWriteupUrl).toBe(false);
  });

  it("preserves meaningful flag whitespace for per-problem normalization", () => {
    const result = createExternalChallengeSchema.parse({
      ...validCreateInput,
      flag: "  DH{spaces_are_part_of_the_answer}  ",
      trimWhitespace: "false",
      maxAttempts: "",
    });

    expect(result.flag).toBe("  DH{spaces_are_part_of_the_answer}  ");
    expect(result.trimWhitespace).toBe(false);
    expect(result.maxAttempts).toBeUndefined();
  });

  it("allows writeup-only challenges without registering a flag", () => {
    const result = createExternalChallengeSchema.parse({
      ...validCreateInput,
      flag: "",
      flagFormat: "",
      maxAttempts: "",
      penaltyPerWrongAttempt: "0",
      requireWriteup: "on",
    });

    expect(result.flag).toBeUndefined();
    expect(result.flagFormat).toBeUndefined();
    expect(result.requireWriteup).toBe(true);
  });

  it("requires at least one submission method and consistent flag-only settings", () => {
    expect(
      createExternalChallengeSchema.safeParse({
        ...validCreateInput,
        flag: "",
        flagFormat: "",
        penaltyPerWrongAttempt: "0",
      }).success,
    ).toBe(false);
    expect(
      createExternalChallengeSchema.safeParse({
        ...validCreateInput,
        flag: "",
        requireWriteup: "on",
      }).success,
    ).toBe(false);
    expect(
      createExternalChallengeSchema.safeParse({
        ...validCreateInput,
        flag: "",
        flagFormat: "",
        penaltyPerWrongAttempt: "1",
        requireWriteup: "on",
      }).success,
    ).toBe(false);
  });

  it("accepts only credential-free HTTPS URLs", () => {
    expect(safeHttpsUrlSchema.parse("https://example.com/problem")).toBe(
      "https://example.com/problem",
    );
    for (const value of [
      "http://example.com/problem",
      "javascript:alert(1)",
      "data:text/html,hello",
      "https://user:password@example.com/problem",
      "https://exam\nple.com/problem",
      "not a URL",
    ]) {
      expect(safeHttpsUrlSchema.safeParse(value).success).toBe(false);
      expect(normalizeSafeHttpsUrl(value)).toBeNull();
    }
    expect(
      safeHttpsUrlSchema.safeParse(`https://example.com/${"a".repeat(MAX_CHALLENGE_URL_LENGTH)}`)
        .success,
    ).toBe(false);
  });

  it("enforces text, enum, score, penalty, and attempt bounds", () => {
    const invalidOverrides = [
      { title: "x".repeat(MAX_CHALLENGE_TITLE_LENGTH + 1) },
      { description: "x".repeat(MAX_CHALLENGE_DESCRIPTION_LENGTH + 1) },
      { source: "UNSUPPORTED" },
      { category: "UNSUPPORTED" },
      { points: "-1" },
      { points: String(MAX_CHALLENGE_POINTS + 1) },
      { points: "1.5" },
      { maxAttempts: "0" },
      { maxAttempts: String(MAX_CHALLENGE_ATTEMPTS + 1) },
      { maxAttempts: "2.5" },
      { penaltyPerWrongAttempt: "101" },
      { flag: "x".repeat(MAX_CHALLENGE_FLAG_LENGTH + 1) },
      { caseSensitive: "unexpected" },
    ];

    for (const override of invalidOverrides) {
      expect(createExternalChallengeSchema.safeParse({ ...validCreateInput, ...override }).success)
        .toBe(false);
    }
  });
});

describe("challenge submission schema", () => {
  it("accepts and normalizes each supported submission value", () => {
    const result = submitChallengeSchema.parse({
      organizationId,
      assignmentId,
      itemId,
      flag: "DH{candidate}",
      writeup: "  풀이 과정  ",
      writeupUrl: "HTTPS://EXAMPLE.COM/writeups/1",
    });

    expect(result.flag).toBe("DH{candidate}");
    expect(result.writeup).toBe("풀이 과정");
    expect(result.writeupUrl).toBe("https://example.com/writeups/1");
  });

  it("rejects empty submissions, invalid IDs, unsafe links, and oversized content", () => {
    expect(
      submitChallengeSchema.safeParse({ organizationId, assignmentId, itemId }).success,
    ).toBe(false);
    expect(
      submitChallengeSchema.safeParse({
        organizationId,
        assignmentId,
        itemId: "not-a-uuid",
        flag: "DH{candidate}",
      }).success,
    ).toBe(false);
    expect(
      submitChallengeSchema.safeParse({
        organizationId,
        assignmentId,
        itemId,
        writeupUrl: "http://example.com/writeup",
      }).success,
    ).toBe(false);
    expect(
      submitChallengeSchema.safeParse({
        organizationId,
        assignmentId,
        itemId,
        writeup: "x".repeat(MAX_CHALLENGE_WRITEUP_LENGTH + 1),
      }).success,
    ).toBe(false);
  });
});
