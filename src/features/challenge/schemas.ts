import { ChallengeCategory, ExternalChallengeSource } from "@prisma/client";
import { z } from "zod";
import {
  MAX_CHALLENGE_ATTEMPTS,
  MAX_CHALLENGE_DESCRIPTION_LENGTH,
  MAX_CHALLENGE_DIFFICULTY_LENGTH,
  MAX_CHALLENGE_FLAG_FORMAT_LENGTH,
  MAX_CHALLENGE_FLAG_LENGTH,
  MAX_CHALLENGE_PENALTY_PER_WRONG_ATTEMPT,
  MAX_CHALLENGE_PLATFORM_LENGTH,
  MAX_CHALLENGE_POINTS,
  MAX_CHALLENGE_TITLE_LENGTH,
  MAX_CHALLENGE_URL_LENGTH,
  MAX_CHALLENGE_WRITEUP_LENGTH,
} from "@/constants/challenge";

const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/;

const checkboxSchema = z
  .union([
    z.literal("on"),
    z.literal("true"),
    z.literal("false"),
    z.literal(true),
    z.literal(false),
    z.null(),
    z.undefined(),
  ])
  .transform((value) => value === "on" || value === "true" || value === true);

function emptyFormValueToUndefined(value: unknown) {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "string" && value.trim() === "") return undefined;
  return value;
}

function requiredIntegerSchema(minimum: number, maximum: number) {
  return z.preprocess(
    emptyFormValueToUndefined,
    z.coerce.number().int().min(minimum).max(maximum),
  );
}

function optionalIntegerSchema(minimum: number, maximum: number) {
  return z.preprocess(
    emptyFormValueToUndefined,
    z.coerce.number().int().min(minimum).max(maximum).optional(),
  );
}

function optionalTrimmedStringSchema(maximumLength: number) {
  return z.preprocess(
    emptyFormValueToUndefined,
    z.string().trim().min(1).max(maximumLength).optional(),
  );
}

const optionalFlagSchema = z.preprocess(
  (value) => (value === null || value === undefined || value === "" ? undefined : value),
  z
    .string()
    .max(MAX_CHALLENGE_FLAG_LENGTH)
    .refine((value) => value.trim().length > 0, "플래그는 공백만 입력할 수 없습니다.")
    .optional(),
);

export function normalizeSafeHttpsUrl(value: string) {
  if (value.length > MAX_CHALLENGE_URL_LENGTH || CONTROL_CHARACTER_PATTERN.test(value)) {
    return null;
  }
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      !url.hostname ||
      url.username !== "" ||
      url.password !== "" ||
      url.href.length > MAX_CHALLENGE_URL_LENGTH
    ) {
      return null;
    }
    return url.href;
  } catch {
    return null;
  }
}

export const safeHttpsUrlSchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_CHALLENGE_URL_LENGTH)
  .transform((value, context) => {
    const normalizedUrl = normalizeSafeHttpsUrl(value);
    if (!normalizedUrl) {
      context.addIssue({
        code: "custom",
        message: "사용자 정보가 포함되지 않은 안전한 HTTPS 주소를 입력해 주세요.",
      });
      return z.NEVER;
    }
    return normalizedUrl;
  });

const optionalSafeHttpsUrlSchema = z.preprocess(
  emptyFormValueToUndefined,
  safeHttpsUrlSchema.optional(),
);

const externalChallengeSourceSchema = z.enum([
  ExternalChallengeSource.DREAMHACK,
  ExternalChallengeSource.OTHER,
]);

const challengeCategorySchema = z.enum([
  ChallengeCategory.WEB,
  ChallengeCategory.SYSTEM,
  ChallengeCategory.REVERSING,
  ChallengeCategory.FORENSICS,
  ChallengeCategory.CRYPTOGRAPHY,
  ChallengeCategory.NETWORK,
  ChallengeCategory.PROGRAMMING,
  ChallengeCategory.OTHER,
]);

export const createExternalChallengeSchema = z
  .object({
    organizationId: z.uuid(),
    assignmentId: z.uuid(),
    source: externalChallengeSourceSchema,
    platform: z.string().trim().min(1).max(MAX_CHALLENGE_PLATFORM_LENGTH),
    title: z.string().trim().min(1).max(MAX_CHALLENGE_TITLE_LENGTH),
    description: z.string().trim().min(1).max(MAX_CHALLENGE_DESCRIPTION_LENGTH),
    problemUrl: safeHttpsUrlSchema,
    category: challengeCategorySchema,
    difficulty: z.string().trim().min(1).max(MAX_CHALLENGE_DIFFICULTY_LENGTH),
    points: requiredIntegerSchema(0, MAX_CHALLENGE_POINTS),
    flag: optionalFlagSchema,
    flagFormat: optionalTrimmedStringSchema(MAX_CHALLENGE_FLAG_FORMAT_LENGTH),
    caseSensitive: checkboxSchema,
    trimWhitespace: checkboxSchema,
    maxAttempts: optionalIntegerSchema(1, MAX_CHALLENGE_ATTEMPTS),
    penaltyPerWrongAttempt: requiredIntegerSchema(
      0,
      MAX_CHALLENGE_PENALTY_PER_WRONG_ATTEMPT,
    ),
    requireWriteup: checkboxSchema,
    requireWriteupUrl: checkboxSchema,
  })
  .superRefine((data, context) => {
    if (!data.flag && !data.requireWriteup && !data.requireWriteupUrl) {
      context.addIssue({
        code: "custom",
        path: ["flag"],
        message: "플래그, 풀이, 라이트업 링크 중 하나 이상의 제출 방식을 설정해 주세요.",
      });
    }
    if (!data.flag && data.flagFormat) {
      context.addIssue({
        code: "custom",
        path: ["flagFormat"],
        message: "플래그 형식 안내를 사용하려면 정답 플래그를 입력해 주세요.",
      });
    }
    if (!data.flag && data.penaltyPerWrongAttempt > 0) {
      context.addIssue({
        code: "custom",
        path: ["penaltyPerWrongAttempt"],
        message: "오답 감점은 플래그 자동 채점을 사용할 때만 설정할 수 있습니다.",
      });
    }
    if (data.penaltyPerWrongAttempt > data.points) {
      context.addIssue({
        code: "custom",
        path: ["penaltyPerWrongAttempt"],
        message: "오답 1회당 감점은 문제 배점을 초과할 수 없습니다.",
      });
    }
  });

export const submitChallengeSchema = z
  .object({
    organizationId: z.uuid(),
    assignmentId: z.uuid(),
    itemId: z.uuid(),
    flag: optionalFlagSchema,
    writeup: optionalTrimmedStringSchema(MAX_CHALLENGE_WRITEUP_LENGTH),
    writeupUrl: optionalSafeHttpsUrlSchema,
  })
  .superRefine((data, context) => {
    if (!data.flag && !data.writeup && !data.writeupUrl) {
      context.addIssue({
        code: "custom",
        message: "플래그, 풀이, 라이트업 링크 중 하나 이상을 제출해 주세요.",
      });
    }
  });

export const challengeItemIdSchema = z.uuid();
