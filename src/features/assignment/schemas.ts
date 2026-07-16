import { AssignmentAudience, AssignmentFieldType } from "@prisma/client";
import { z } from "zod";
import {
  MAX_ASSIGNMENT_DESCRIPTION_LENGTH,
  MAX_ASSIGNMENT_TARGET_COUNT,
  MAX_ASSIGNMENT_TITLE_LENGTH,
} from "@/constants/assignment";

const koreanLocalDateTimeSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/)
  .transform((value) => new Date(`${value}${value.length === 16 ? ":00" : ""}+09:00`))
  .refine((value) => !Number.isNaN(value.getTime()), "날짜 형식을 확인해 주세요.");

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
