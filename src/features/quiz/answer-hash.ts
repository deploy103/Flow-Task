import { createHmac, timingSafeEqual } from "node:crypto";
import { MIN_CHALLENGE_FLAG_PEPPER_LENGTH } from "@/constants/challenge";

const DOMAIN = "flow-task/quiz-answer/v1\0";
const DIGEST_PATTERN = /^[0-9a-f]{64}$/;

export type QuizAnswerNormalization = { caseSensitive: boolean; trimWhitespace: boolean };

function pepper(explicit?: string) {
  const value = explicit ?? process.env.CHALLENGE_FLAG_PEPPER;
  if (!value || value.length < MIN_CHALLENGE_FLAG_PEPPER_LENGTH) throw new Error("QUIZ_ANSWER_PEPPER_REQUIRED");
  return value;
}

export function normalizeQuizAnswer(value: string, options: QuizAnswerNormalization) {
  const whitespace = options.trimWhitespace ? value.trim() : value;
  return options.caseSensitive ? whitespace : whitespace.toLocaleLowerCase("en-US");
}

export function hashQuizAnswer(value: string, options: QuizAnswerNormalization & { pepper?: string }) {
  const normalized = normalizeQuizAnswer(value, options);
  if (!normalized.trim()) throw new Error("QUIZ_ANSWER_EMPTY");
  return createHmac("sha256", pepper(options.pepper)).update(DOMAIN).update(normalized).digest("hex");
}

export function matchesQuizAnswer(value: string, digests: string[], options: QuizAnswerNormalization & { pepper?: string }) {
  const candidate = Buffer.from(hashQuizAnswer(value, options), "hex");
  let matched = false;
  for (const digest of digests) {
    const valid = DIGEST_PATTERN.test(digest);
    const expected = valid ? Buffer.from(digest, "hex") : Buffer.alloc(candidate.length);
    matched = (timingSafeEqual(candidate, expected) && valid) || matched;
  }
  return matched;
}
