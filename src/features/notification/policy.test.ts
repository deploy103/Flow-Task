import { AssignmentAudience, SubmissionStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { getDeadlineNotificationKind, isAssignmentNotificationPublished, shouldNotifyAssignmentTarget } from "./policy";

const now = new Date("2026-07-19T12:00:00.000Z");

describe("notification policy", () => {
  it("limits selected assignments to their targets", () => {
    expect(shouldNotifyAssignmentTarget({ audience: AssignmentAudience.SELECTED_MEMBERS, targetUserIds: ["a"], userId: "b" })).toBe(false);
    expect(shouldNotifyAssignmentTarget({ audience: AssignmentAudience.ALL_MEMBERS, targetUserIds: [], userId: "b" })).toBe(true);
  });

  it("derives deadline and missing notices only before a final submission", () => {
    const base = { now, opensAt: new Date("2026-07-18T00:00:00.000Z") };
    expect(getDeadlineNotificationKind({ ...base, deadline: new Date("2026-07-20T00:00:00.000Z") })).toBe("DEADLINE_APPROACHING");
    expect(getDeadlineNotificationKind({ ...base, deadline: new Date("2026-07-19T00:00:00.000Z") })).toBe("MISSING_SUBMISSION");
    expect(getDeadlineNotificationKind({ ...base, deadline: new Date("2026-07-20T00:00:00.000Z"), submissionStatus: SubmissionStatus.SUBMITTED })).toBeNull();
  });

  it("does not expose a future assignment before its publication time", () => {
    expect(isAssignmentNotificationPublished(new Date("2026-07-19T12:00:01.000Z"), now)).toBe(false);
    expect(isAssignmentNotificationPublished(new Date("2026-07-19T12:00:00.000Z"), now)).toBe(true);
  });
});
