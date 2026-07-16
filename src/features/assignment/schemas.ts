import { AssignmentAudience, AssignmentFieldType } from "@prisma/client";
import { z } from "zod";
import {
  KOREAN_TIME_OFFSET_MILLISECONDS,
  MAX_ASSIGNMENT_DESCRIPTION_LENGTH,
  MAX_ASSIGNMENT_TARGET_COUNT,
  MAX_ASSIGNMENT_TITLE_LENGTH,
} from "@/constants/assignment";

const KOREAN_LOCAL_DATE_TIME_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

type LocalDateTimeComponents = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function parseDateTimeComponents(value: string): LocalDateTimeComponents | null {
  const match = KOREAN_LOCAL_DATE_TIME_PATTERN.exec(value);
  if (!match) return null;
  const [, year, month, day, hour, minute, second = "00"] = match;
  const components = {
    year: Number(year),
    month: Number(month),
    day: Number(day),
    hour: Number(hour),
    minute: Number(minute),
    second: Number(second),
  };
  const inRange =
    components.year >= 1 &&
    components.year <= 9999 &&
    components.month >= 1 &&
    components.month <= 12 &&
    components.day >= 1 &&
    components.day <= 31 &&
    components.hour >= 0 &&
    components.hour <= 23 &&
    components.minute >= 0 &&
    components.minute <= 59 &&
    components.second >= 0 &&
    components.second <= 59;
  return inRange ? components : null;
}

export function parseKoreanLocalDateTime(value: string) {
  const components = parseDateTimeComponents(value);
  if (!components) return null;

  const normalizedWallClock = new Date(0);
  normalizedWallClock.setUTCFullYear(components.year, components.month - 1, components.day);
  normalizedWallClock.setUTCHours(components.hour, components.minute, components.second, 0);
  const isSameCalendarDate =
    normalizedWallClock.getUTCFullYear() === components.year &&
    normalizedWallClock.getUTCMonth() === components.month - 1 &&
    normalizedWallClock.getUTCDate() === components.day &&
    normalizedWallClock.getUTCHours() === components.hour &&
    normalizedWallClock.getUTCMinutes() === components.minute &&
    normalizedWallClock.getUTCSeconds() === components.second;
  if (!isSameCalendarDate) return null;

  return new Date(normalizedWallClock.getTime() - KOREAN_TIME_OFFSET_MILLISECONDS);
}

const koreanLocalDateTimeSchema = z
  .string()
  .trim()
  .transform((value, context) => {
    const parsed = parseKoreanLocalDateTime(value);
    if (!parsed) {
      context.addIssue({ code: "custom", message: "존재하는 KST 날짜와 시간을 입력해 주세요." });
      return z.NEVER;
    }
    return parsed;
  });

export const createAssignmentSchema = z
  .object({
    organizationId: z.uuid(),
    title: z.string().trim().min(1, "제목을 입력해 주세요.").max(MAX_ASSIGNMENT_TITLE_LENGTH),
    description: z
      .string()
      .trim()
      .min(1, "설명을 입력해 주세요.")
      .max(MAX_ASSIGNMENT_DESCRIPTION_LENGTH),
    audience: z.enum([AssignmentAudience.ALL_MEMBERS, AssignmentAudience.SELECTED_MEMBERS]),
    opensAt: koreanLocalDateTimeSchema,
    deadline: koreanLocalDateTimeSchema,
    allowLate: z.preprocess((value) => value === "on" || value === "true", z.boolean()),
  })
  .superRefine((data, context) => {
    if (data.opensAt >= data.deadline) {
      context.addIssue({
        code: "custom",
        path: ["deadline"],
        message: "마감일은 공개일보다 늦어야 합니다.",
      });
    }
  });

export const assignmentTargetIdsSchema = z.array(z.uuid()).max(MAX_ASSIGNMENT_TARGET_COUNT);
export const assignmentOrganizationIdSchema = z.uuid();
export const assignmentFieldTypesSchema = z
  .array(z.enum([AssignmentFieldType.TEXT, AssignmentFieldType.FILE, AssignmentFieldType.LINK]))
  .min(1)
  .max(3)
  .refine((types) => new Set(types).size === types.length, "제출 항목은 중복될 수 없습니다.");
