import { SubmissionReviewDecision, SubmissionStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { getStatusForReviewDecision } from "./status";

describe("review decision status", () => {
  it("maps every review decision to a submission status", () => {
    expect(getStatusForReviewDecision(SubmissionReviewDecision.REVIEWING)).toBe(SubmissionStatus.REVIEWING);
    expect(getStatusForReviewDecision(SubmissionReviewDecision.APPROVED)).toBe(SubmissionStatus.APPROVED);
    expect(getStatusForReviewDecision(SubmissionReviewDecision.RESUBMIT_REQUIRED)).toBe(
      SubmissionStatus.RESUBMIT_REQUIRED,
    );
  });
});
