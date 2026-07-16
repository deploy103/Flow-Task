import { SubmissionStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { resolveSubmissionStatus } from "./state";

const assignment = {
  opensAt: new Date("2026-07-16T00:00:00Z"),
  deadline: new Date("2026-07-18T00:00:00Z"),
  allowLate: false,
};

describe("submission state", () => {
  it("blocks draft and final submission before the assignment opens", () => {
    const now = new Date("2026-07-15T23:59:59Z");
    expect(resolveSubmissionStatus("draft", assignment, now)).toEqual({ allowed: false, reason: "not_open" });
    expect(resolveSubmissionStatus("submit", assignment, now)).toEqual({ allowed: false, reason: "not_open" });
  });

  it("keeps drafts distinct and treats the exact deadline as on time", () => {
    expect(resolveSubmissionStatus("draft", assignment, assignment.deadline)).toEqual({
      allowed: true,
      status: SubmissionStatus.DRAFT,
      submittedAt: null,
    });
    expect(resolveSubmissionStatus("submit", assignment, assignment.deadline)).toEqual({
      allowed: true,
      status: SubmissionStatus.SUBMITTED,
      submittedAt: assignment.deadline,
    });
  });

  it("blocks closed assignments and marks allowed late submissions", () => {
    const afterDeadline = new Date("2026-07-18T00:00:00.001Z");
    expect(resolveSubmissionStatus("submit", assignment, afterDeadline)).toEqual({
      allowed: false,
      reason: "closed",
    });
    expect(resolveSubmissionStatus("draft", { ...assignment, allowLate: true }, afterDeadline)).toEqual({
      allowed: true,
      status: SubmissionStatus.DRAFT,
      submittedAt: null,
    });
    expect(resolveSubmissionStatus("submit", { ...assignment, allowLate: true }, afterDeadline)).toEqual({
      allowed: true,
      status: SubmissionStatus.LATE,
      submittedAt: afterDeadline,
    });
  });
});
