import { SubmissionReviewDecision, SubmissionStatus } from "@prisma/client";

export function getStatusForReviewDecision(decision: SubmissionReviewDecision) {
  if (decision === SubmissionReviewDecision.APPROVED) return SubmissionStatus.APPROVED;
  if (decision === SubmissionReviewDecision.RESUBMIT_REQUIRED) {
    return SubmissionStatus.RESUBMIT_REQUIRED;
  }
  return SubmissionStatus.REVIEWING;
}
