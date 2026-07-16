import { z } from "zod";
import { MAX_SUBMISSION_LINK_LENGTH, MAX_SUBMISSION_TEXT_LENGTH } from "@/constants/assignment";
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
