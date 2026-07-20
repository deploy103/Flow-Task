import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  hashChallengeFlag,
  normalizeChallengeFlag,
  verifyChallengeFlag,
} from "./flag";

const pepper = "phase-8-test-pepper-value-at-least-32-characters";
const strictOptions = {
  caseSensitive: true,
  trimWhitespace: true,
  pepper,
};

describe("challenge flag hashing", () => {
  it("uses a domain-separated HMAC-SHA256 digest instead of storing the flag", () => {
    const flag = "DH{server-side-secret}";
    const digest = hashChallengeFlag(flag, strictOptions);
    const expected = createHmac("sha256", pepper)
      .update("flow-task/challenge-flag/v1\0", "utf8")
      .update(flag, "utf8")
      .digest("hex");

    expect(digest).toBe(expected);
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
    expect(digest).not.toContain(flag);
  });

  it("applies the stored case and surrounding-whitespace options consistently", () => {
    const normalizedOptions = {
      caseSensitive: false,
      trimWhitespace: true,
      pepper,
    };
    const digest = hashChallengeFlag("  DH{MiXeD} \n", normalizedOptions);

    expect(verifyChallengeFlag("dh{mixed}", digest, normalizedOptions)).toBe(true);
    expect(verifyChallengeFlag("  dH{MIXED}\t", digest, normalizedOptions)).toBe(true);
    expect(verifyChallengeFlag("DH{MIXED}", digest, strictOptions)).toBe(false);
    expect(
      verifyChallengeFlag("dh{mixed}", digest, {
        ...normalizedOptions,
        trimWhitespace: false,
      }),
    ).toBe(true);
    expect(
      verifyChallengeFlag(" dh{mixed} ", digest, {
        ...normalizedOptions,
        trimWhitespace: false,
      }),
    ).toBe(false);
  });

  it("rejects wrong candidates and malformed stored digests", () => {
    const digest = hashChallengeFlag("DH{correct}", strictOptions);

    expect(verifyChallengeFlag("DH{wrong}", digest, strictOptions)).toBe(false);
    expect(verifyChallengeFlag("DH{correct}", "not-a-sha256-digest", strictOptions)).toBe(false);
    expect(verifyChallengeFlag("DH{correct}", "A".repeat(64), strictOptions)).toBe(false);
  });

  it("validates the pepper only when a hashing or verification operation runs", () => {
    const previousPepper = process.env.CHALLENGE_FLAG_PEPPER;
    delete process.env.CHALLENGE_FLAG_PEPPER;
    try {
      expect(
        normalizeChallengeFlag("  DH{FLAG}  ", {
          caseSensitive: false,
          trimWhitespace: true,
        }),
      ).toBe("dh{flag}");
      expect(() =>
        hashChallengeFlag("DH{FLAG}", {
          caseSensitive: true,
          trimWhitespace: true,
        }),
      ).toThrow(/CHALLENGE_FLAG_PEPPER/);
      expect(() =>
        hashChallengeFlag("DH{FLAG}", {
          caseSensitive: true,
          trimWhitespace: true,
          pepper: "too-short",
        }),
      ).toThrow(/at least 32/);
    } finally {
      if (previousPepper === undefined) delete process.env.CHALLENGE_FLAG_PEPPER;
      else process.env.CHALLENGE_FLAG_PEPPER = previousPepper;
    }
  });

  it("does not allow an empty normalized answer to be registered", () => {
    expect(() => hashChallengeFlag("  \n\t", strictOptions)).toThrow(/must not be empty/);
  });
});
