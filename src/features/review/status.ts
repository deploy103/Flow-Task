import { SubmissionReviewDecision, SubmissionStatus } from "@prisma/client";

export function isLateSubmission(submittedAt: Date | null, deadline: Date) {
  return submittedAt !== null && submittedAt > deadline;
}

export function getStatusForReviewDecision(decision: SubmissionReviewDecision) {
  if (decision === SubmissionReviewDecision.APPROVED) return SubmissionStatus.APPROVED;
  if (decision === SubmissionReviewDecision.RESUBMIT_REQUIRED) {
    return SubmissionStatus.RESUBMIT_REQUIRED;
  }
  return SubmissionStatus.REVIEWING;
}
