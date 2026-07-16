import { SubmissionReviewDecision } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { reviewSubmissionSchema } from "./schemas";

describe("submission review schema", () => {
  it("accepts approval with an optional bounded score", () => {
    expect(
      reviewSubmissionSchema.safeParse({
        decision: SubmissionReviewDecision.APPROVED,
        feedback: "좋습니다.",
        score: "95",
      }).success,
    ).toBe(true);
    expect(
      reviewSubmissionSchema.safeParse({
        decision: SubmissionReviewDecision.REVIEWING,
        feedback: "검토 중입니다.",
      }).success,
    ).toBe(true);
  });

  it("requires feedback for resubmission and rejects scores outside 0..100", () => {
    expect(
      reviewSubmissionSchema.safeParse({
        decision: SubmissionReviewDecision.RESUBMIT_REQUIRED,
        feedback: "",
        score: "50",
      }).success,
    ).toBe(false);
    expect(
      reviewSubmissionSchema.safeParse({
        decision: SubmissionReviewDecision.APPROVED,
        feedback: "",
        score: "101",
      }).success,
    ).toBe(false);
  });
});
