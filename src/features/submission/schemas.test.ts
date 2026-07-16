import { describe, expect, it } from "vitest";
import { submissionContextSchema, submissionLinkSchema } from "./schemas";

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
});
