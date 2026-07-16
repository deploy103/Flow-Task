import { describe, expect, it } from "vitest";
import { MAX_SUBMISSION_FILE_COUNT } from "@/constants/assignment";
import {
  createSubmissionUploadSchema,
  submissionContextSchema,
  submissionLinkSchema,
  submissionUploadIdsSchema,
} from "./schemas";

describe("submission schemas", () => {
  it("validates context identifiers and intent", () => {
    expect(
      submissionContextSchema.safeParse({
        organizationId: "11111111-1111-4111-8111-111111111111",
        assignmentId: "22222222-2222-4222-8222-222222222222",
        intent: "submit",
      }).success,
    ).toBe(true);
    expect(
      submissionContextSchema.safeParse({
        organizationId: "not-a-uuid",
        assignmentId: "22222222-2222-4222-8222-222222222222",
        intent: "delete",
      }).success,
    ).toBe(false);
  });

  it("permits an empty draft link but rejects unsafe protocols", () => {
    expect(submissionLinkSchema.safeParse("").success).toBe(true);
    expect(submissionLinkSchema.safeParse("https://example.com/result").success).toBe(true);
    expect(submissionLinkSchema.safeParse("javascript:alert(1)").success).toBe(false);
  });

  it("validates upload metadata and unique pending upload IDs", () => {
    expect(
      createSubmissionUploadSchema.safeParse({
        fieldId: "33333333-3333-4333-8333-333333333333",
        filename: "report.pdf",
        mimeType: "application/pdf",
        sizeBytes: 1024,
      }).success,
    ).toBe(true);
    const uploadId = "44444444-4444-4444-8444-444444444444";
    expect(submissionUploadIdsSchema.safeParse([uploadId, uploadId]).success).toBe(false);
    expect(
      submissionUploadIdsSchema.safeParse(
        Array.from({ length: MAX_SUBMISSION_FILE_COUNT + 1 }, (_, index) =>
          `${index}`.padStart(8, "0") + "-4444-4444-8444-444444444444",
        ),
      ).success,
    ).toBe(false);
  });
});
