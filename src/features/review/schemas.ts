import { SubmissionReviewDecision } from "@prisma/client";
import { z } from "zod";
import {
  MAX_REVIEW_FEEDBACK_LENGTH,
  MAX_REVIEW_SCORE,
  MIN_REVIEW_SCORE,
} from "@/constants/review";

export const reviewContextSchema = z.object({
  organizationId: z.uuid(),
  assignmentId: z.uuid(),
  submissionId: z.uuid(),
  versionId: z.uuid(),
});

export const reviewSubmissionSchema = z
  .object({
    decision: z.enum([
      SubmissionReviewDecision.REVIEWING,
      SubmissionReviewDecision.APPROVED,
      SubmissionReviewDecision.RESUBMIT_REQUIRED,
    ]),
    feedback: z.string().trim().max(MAX_REVIEW_FEEDBACK_LENGTH),
    score: z.preprocess(
      (value) => (value === "" || value == null ? undefined : Number(value)),
      z.number().int().min(MIN_REVIEW_SCORE).max(MAX_REVIEW_SCORE).optional(),
    ),
  })
  .superRefine((data, context) => {
    if (data.decision === SubmissionReviewDecision.RESUBMIT_REQUIRED && !data.feedback) {
      context.addIssue({
        code: "custom",
        path: ["feedback"],
        message: "재제출 요청에는 피드백이 필요합니다.",
      });
    }
  });
