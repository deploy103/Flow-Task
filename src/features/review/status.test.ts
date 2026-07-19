import { SubmissionReviewDecision, SubmissionStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { getStatusForReviewDecision, isLateSubmission } from "./status";

describe("review decision status", () => {
  it("maps every review decision to a submission status", () => {
    expect(getStatusForReviewDecision(SubmissionReviewDecision.REVIEWING)).toBe(SubmissionStatus.REVIEWING);
    expect(getStatusForReviewDecision(SubmissionReviewDecision.APPROVED)).toBe(SubmissionStatus.APPROVED);
    expect(getStatusForReviewDecision(SubmissionReviewDecision.RESUBMIT_REQUIRED)).toBe(
      SubmissionStatus.RESUBMIT_REQUIRED,
    );
  });

  it("keeps late timing independent from every review status", () => {
    const deadline = new Date("2026-07-18T00:00:00.000Z");
    const lateSubmittedAt = new Date("2026-07-18T00:00:00.001Z");

    for (const status of [
      SubmissionStatus.REVIEWING,
      SubmissionStatus.APPROVED,
      SubmissionStatus.RESUBMIT_REQUIRED,
    ]) {
      expect(status).not.toBe(SubmissionStatus.LATE);
      expect(isLateSubmission(lateSubmittedAt, deadline)).toBe(true);
    }
    expect(isLateSubmission(deadline, deadline)).toBe(false);
    expect(isLateSubmission(null, deadline)).toBe(false);
  });
});
