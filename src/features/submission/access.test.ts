import { AssignmentAudience, MembershipRole, MembershipStatus, SystemRole } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { canDownloadSubmissionFile, canSubmitAssignment } from "./access";

describe("submission access", () => {
  it("allows an active member to submit an all-members assignment", () => {
    expect(
      canSubmitAssignment({
        audience: AssignmentAudience.ALL_MEMBERS,
        targetUserIds: [],
        userId: "member-1",
        membershipStatus: MembershipStatus.ACTIVE,
      }),
    ).toBe(true);
  });

  it("requires selected members to be an explicit target", () => {
    const input = {
      audience: AssignmentAudience.SELECTED_MEMBERS,
      targetUserIds: ["member-2"],
      userId: "member-1",
      membershipStatus: MembershipStatus.ACTIVE,
    };
    expect(canSubmitAssignment(input)).toBe(false);
    expect(canSubmitAssignment({ ...input, targetUserIds: ["member-1"] })).toBe(true);
  });

  it("rejects inactive or missing memberships even when targeted", () => {
    const input = {
      audience: AssignmentAudience.SELECTED_MEMBERS,
      targetUserIds: ["member-1"],
      userId: "member-1",
    };
    expect(canSubmitAssignment({ ...input, membershipStatus: MembershipStatus.INACTIVE })).toBe(false);
    expect(canSubmitAssignment({ ...input, membershipStatus: null })).toBe(false);
  });
});

describe("submission file download access", () => {
  it("allows only an active owner or an administrator in the file organization", () => {
    const activeMember = { role: MembershipRole.MEMBER, status: MembershipStatus.ACTIVE };
    expect(
      canDownloadSubmissionFile({ isOwner: true, systemRole: SystemRole.USER, membership: activeMember }),
    ).toBe(true);
    expect(
      canDownloadSubmissionFile({ isOwner: false, systemRole: SystemRole.USER, membership: activeMember }),
    ).toBe(false);
    expect(
      canDownloadSubmissionFile({
        isOwner: false,
        systemRole: SystemRole.USER,
        membership: { role: MembershipRole.ORG_ADMIN, status: MembershipStatus.ACTIVE },
      }),
    ).toBe(true);
    expect(
      canDownloadSubmissionFile({
        isOwner: false,
        systemRole: SystemRole.USER,
        membership: { role: MembershipRole.MENTOR, status: MembershipStatus.ACTIVE },
      }),
    ).toBe(true);
  });

  it("rejects inactive owners while retaining system administrator access", () => {
    expect(
      canDownloadSubmissionFile({
        isOwner: true,
        systemRole: SystemRole.USER,
        membership: { role: MembershipRole.MEMBER, status: MembershipStatus.INACTIVE },
      }),
    ).toBe(false);
    expect(
      canDownloadSubmissionFile({ isOwner: false, systemRole: SystemRole.SYSTEM_ADMIN }),
    ).toBe(true);
  });
});
