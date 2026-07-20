import { AssignmentAudience, MembershipStatus, SystemRole } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { canDownloadChallengeResource } from "./resource-access";

const base = {
  archivedAt: null,
  audience: AssignmentAudience.SELECTED_MEMBERS,
  opensAt: new Date("2026-07-20T00:00:00Z"),
  targetUserIds: ["member"],
  userId: "member",
  systemRole: SystemRole.USER,
  membershipStatus: MembershipStatus.ACTIVE,
  canManage: false,
  canReview: false,
  now: new Date("2026-07-20T01:00:00Z"),
};

describe("challenge resource download access", () => {
  it("allows only active assignment targets after publication", () => {
    expect(canDownloadChallengeResource(base)).toBe(true);
    expect(canDownloadChallengeResource({ ...base, userId: "other" })).toBe(false);
    expect(canDownloadChallengeResource({ ...base, membershipStatus: MembershipStatus.INACTIVE })).toBe(false);
    expect(canDownloadChallengeResource({ ...base, now: new Date("2026-07-19T23:59:59Z") })).toBe(false);
  });

  it("allows reviewers before publication but never archived resources", () => {
    expect(canDownloadChallengeResource({ ...base, userId: "mentor", canReview: true, now: new Date("2026-07-19T00:00:00Z") })).toBe(true);
    expect(canDownloadChallengeResource({ ...base, canManage: true, archivedAt: new Date() })).toBe(false);
  });
});
