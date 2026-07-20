import { createHmac, timingSafeEqual } from "node:crypto";
import { MIN_CHALLENGE_FLAG_PEPPER_LENGTH } from "@/constants/challenge";

const CHALLENGE_FLAG_HMAC_DOMAIN = "flow-task/challenge-flag/v1\0";
const SHA256_HEX_DIGEST_PATTERN = /^[0-9a-f]{64}$/;

export type ChallengeFlagNormalizationOptions = {
  caseSensitive: boolean;
  trimWhitespace: boolean;
};

export type ChallengeFlagHashOptions = ChallengeFlagNormalizationOptions & {
  pepper?: string;
};

function resolveChallengeFlagPepper(explicitPepper?: string) {
  const pepper = explicitPepper ?? process.env.CHALLENGE_FLAG_PEPPER;
  if (!pepper || pepper.length < MIN_CHALLENGE_FLAG_PEPPER_LENGTH) {
    throw new Error(
      `CHALLENGE_FLAG_PEPPER must contain at least ${MIN_CHALLENGE_FLAG_PEPPER_LENGTH} characters.`,
    );
  }
  return pepper;
}

export function normalizeChallengeFlag(
  flag: string,
  options: ChallengeFlagNormalizationOptions,
) {
  const whitespaceNormalized = options.trimWhitespace ? flag.trim() : flag;
  return options.caseSensitive ? whitespaceNormalized : whitespaceNormalized.toLowerCase();
}

function createChallengeFlagDigestBuffer(flag: string, options: ChallengeFlagHashOptions) {
  const normalizedFlag = normalizeChallengeFlag(flag, options);
  return createHmac("sha256", resolveChallengeFlagPepper(options.pepper))
    .update(CHALLENGE_FLAG_HMAC_DOMAIN, "utf8")
    .update(normalizedFlag, "utf8")
    .digest();
}

export function hashChallengeFlag(flag: string, options: ChallengeFlagHashOptions) {
  if (normalizeChallengeFlag(flag, options).trim().length === 0) {
    throw new Error("Challenge flag must not be empty.");
  }
  return createChallengeFlagDigestBuffer(flag, options).toString("hex");
}

export function verifyChallengeFlag(
  candidate: string,
  expectedDigest: string,
  options: ChallengeFlagHashOptions,
) {
  const candidateDigest = createChallengeFlagDigestBuffer(candidate, options);
  const hasValidExpectedDigest = SHA256_HEX_DIGEST_PATTERN.test(expectedDigest);
  const expectedDigestBuffer = hasValidExpectedDigest
    ? Buffer.from(expectedDigest, "hex")
    : Buffer.alloc(candidateDigest.length);
  const isEqual = timingSafeEqual(candidateDigest, expectedDigestBuffer);
  return hasValidExpectedDigest && isEqual;
}
