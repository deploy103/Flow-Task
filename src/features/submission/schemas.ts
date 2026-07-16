import { z } from "zod";
import {
  MAX_SUBMISSION_FILE_COUNT,
  MAX_SUBMISSION_LINK_LENGTH,
  MAX_SUBMISSION_TEXT_LENGTH,
} from "@/constants/assignment";
import { isSafeSubmissionUrl } from "./policy";

export const submissionContextSchema = z.object({
  organizationId: z.uuid(),
  assignmentId: z.uuid(),
  intent: z.enum(["draft", "submit"]),
});

export const submissionTextSchema = z.string().max(MAX_SUBMISSION_TEXT_LENGTH);
export const submissionLinkSchema = z
  .string()
  .trim()
  .max(MAX_SUBMISSION_LINK_LENGTH)
  .refine((value) => !value || isSafeSubmissionUrl(value), "HTTP 또는 HTTPS 링크만 입력할 수 있습니다.");

export const createSubmissionUploadSchema = z.object({
  fieldId: z.uuid(),
  filename: z.string().min(1),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().positive(),
});

export const cancelSubmissionUploadsSchema = z.object({
  uploadIds: z.array(z.uuid()).min(1).max(MAX_SUBMISSION_FILE_COUNT),
});

export const submissionUploadIdsSchema = z.array(z.uuid()).max(MAX_SUBMISSION_FILE_COUNT).refine(
  (ids) => new Set(ids).size === ids.length,
  "업로드 ID는 중복될 수 없습니다.",
);
