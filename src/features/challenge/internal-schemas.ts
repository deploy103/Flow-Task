import {
  ChallengeCategory,
  ChallengeConnectionProtocol,
  InternalChallengeMode,
} from "@prisma/client";
import { z } from "zod";
import {
  MAX_CHALLENGE_ATTEMPTS,
  MAX_CHALLENGE_DESCRIPTION_LENGTH,
  MAX_CHALLENGE_DIFFICULTY_LENGTH,
  MAX_CHALLENGE_FLAG_FORMAT_LENGTH,
  MAX_CHALLENGE_FLAG_LENGTH,
  MAX_CHALLENGE_HINT_COUNT,
  MAX_CHALLENGE_HINT_LENGTH,
  MAX_CHALLENGE_HOST_LENGTH,
  MAX_CHALLENGE_PENALTY_PER_WRONG_ATTEMPT,
  MAX_CHALLENGE_POINTS,
  MAX_CHALLENGE_PORT,
  MAX_CHALLENGE_TITLE_LENGTH,
  MIN_CHALLENGE_PORT,
} from "@/constants/challenge";

const HOST_PATTERN = /^(?=.{1,253}$)(?![-.])(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)*[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/;

function emptyToUndefined(value: unknown) {
  return typeof value === "string" && value.trim() === "" ? undefined : value ?? undefined;
}

const optionalInteger = (minimum: number, maximum: number) =>
  z.preprocess(emptyToUndefined, z.coerce.number().int().min(minimum).max(maximum).optional());
const requiredInteger = (minimum: number, maximum: number) =>
  z.preprocess(emptyToUndefined, z.coerce.number().int().min(minimum).max(maximum));
const checkbox = z.preprocess(
  (value) => value === "on" || value === "true" || value === true,
  z.boolean(),
);
const optionalText = (maximum: number) =>
  z.preprocess(emptyToUndefined, z.string().trim().min(1).max(maximum).optional());

export function parseChallengeHints(value: string | undefined) {
  if (!value) return [];
  return value
    .split(/\r?\n/)
    .map((hint) => hint.trim())
    .filter(Boolean);
}

export const createInternalChallengeSchema = z
  .object({
    organizationId: z.uuid(),
    assignmentId: z.uuid(),
    title: z.string().trim().min(1).max(MAX_CHALLENGE_TITLE_LENGTH),
    description: z.string().trim().min(1).max(MAX_CHALLENGE_DESCRIPTION_LENGTH),
    category: z.enum(Object.values(ChallengeCategory)),
    difficulty: z.string().trim().min(1).max(MAX_CHALLENGE_DIFFICULTY_LENGTH),
    points: requiredInteger(0, MAX_CHALLENGE_POINTS),
    mode: z.enum(Object.values(InternalChallengeMode)),
    protocol: z.preprocess(emptyToUndefined, z.enum(Object.values(ChallengeConnectionProtocol)).optional()),
    host: z.preprocess(
      emptyToUndefined,
      z.string().trim().max(MAX_CHALLENGE_HOST_LENGTH).regex(HOST_PATTERN).optional(),
    ),
    port: optionalInteger(MIN_CHALLENGE_PORT, MAX_CHALLENGE_PORT),
    instanceTemplateRef: z.preprocess(emptyToUndefined, z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,159}$/).optional()),
    instanceCpuMilli: optionalInteger(100, 2_000),
    instanceMemoryMb: optionalInteger(64, 2_048),
    instanceLifetimeMinutes: optionalInteger(5, 120),
    hints: z.preprocess(emptyToUndefined, z.string().max((MAX_CHALLENGE_HINT_LENGTH + 2) * MAX_CHALLENGE_HINT_COUNT).optional()),
    flag: z.preprocess(
      emptyToUndefined,
      z.string().max(MAX_CHALLENGE_FLAG_LENGTH).refine((value) => value.trim().length > 0).optional(),
    ),
    flagFormat: optionalText(MAX_CHALLENGE_FLAG_FORMAT_LENGTH),
    caseSensitive: checkbox,
    trimWhitespace: checkbox,
    maxAttempts: optionalInteger(1, MAX_CHALLENGE_ATTEMPTS),
    penaltyPerWrongAttempt: requiredInteger(0, MAX_CHALLENGE_PENALTY_PER_WRONG_ATTEMPT),
  })
  .superRefine((data, context) => {
    if (!data.flag) context.addIssue({ code: "custom", path: ["flag"], message: "정답 플래그가 필요합니다." });
    if (data.penaltyPerWrongAttempt > data.points) {
      context.addIssue({ code: "custom", path: ["penaltyPerWrongAttempt"], message: "감점은 배점을 초과할 수 없습니다." });
    }
    const hints = parseChallengeHints(data.hints);
    if (hints.length > MAX_CHALLENGE_HINT_COUNT || hints.some((hint) => hint.length > MAX_CHALLENGE_HINT_LENGTH)) {
      context.addIssue({ code: "custom", path: ["hints"], message: "힌트 수 또는 길이가 제한을 초과했습니다." });
    }
    if (data.mode === InternalChallengeMode.SHARED_SERVER) {
      if (!data.protocol) context.addIssue({ code: "custom", path: ["protocol"], message: "프로토콜이 필요합니다." });
      if (!data.host) context.addIssue({ code: "custom", path: ["host"], message: "호스트가 필요합니다." });
      if (!data.port) context.addIssue({ code: "custom", path: ["port"], message: "포트가 필요합니다." });
    } else if (data.protocol || data.host || data.port) {
      context.addIssue({ code: "custom", path: ["mode"], message: "공용 서버형에만 고정 접속 정보를 설정할 수 있습니다." });
    }
    if (data.mode === InternalChallengeMode.PERSONAL_INSTANCE) {
      if (!data.instanceTemplateRef || !data.instanceCpuMilli || !data.instanceMemoryMb || !data.instanceLifetimeMinutes) context.addIssue({ code: "custom", path: ["instanceTemplateRef"], message: "개인 인스턴스 정책이 필요합니다." });
    } else if (data.instanceTemplateRef || data.instanceCpuMilli || data.instanceMemoryMb || data.instanceLifetimeMinutes) {
      context.addIssue({ code: "custom", path: ["mode"], message: "개인 인스턴스형에만 실행 정책을 설정할 수 있습니다." });
    }
  });
