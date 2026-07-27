import { MembershipRole, MembershipStatus, SystemRole } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { canLeaveOrganization, canManageOrganization, canReviewSubmissions, canViewOrganization } from "./permissions";

describe("organization permissions", () => {
  it("allows only active organization admins to manage", () => {
    expect(canManageOrganization({ systemRole: SystemRole.USER, membership: { role: MembershipRole.ORG_ADMIN, status: MembershipStatus.ACTIVE } })).toBe(true);
    expect(canManageOrganization({ systemRole: SystemRole.USER, membership: { role: MembershipRole.MENTOR, status: MembershipStatus.ACTIVE } })).toBe(false);
    expect(canManageOrganization({ systemRole: SystemRole.USER, membership: { role: MembershipRole.ORG_ADMIN, status: MembershipStatus.INACTIVE } })).toBe(false);
  });

  it("allows a system administrator without membership", () => {
    expect(canManageOrganization({ systemRole: SystemRole.SYSTEM_ADMIN, membership: null })).toBe(true);
    expect(canViewOrganization({ systemRole: SystemRole.SYSTEM_ADMIN, membership: null })).toBe(true);
  });

  it("denies a user who is not an active member", () => {
    expect(canViewOrganization({ systemRole: SystemRole.USER, membership: null })).toBe(false);
  });

  it("allows active mentors and admins to review submissions", () => {
    expect(
      canReviewSubmissions({
        systemRole: SystemRole.USER,
        membership: { role: MembershipRole.MENTOR, status: MembershipStatus.ACTIVE },
      }),
    ).toBe(true);
    expect(
      canReviewSubmissions({
        systemRole: SystemRole.USER,
        membership: { role: MembershipRole.MEMBER, status: MembershipStatus.ACTIVE },
      }),
    ).toBe(false);
  });

  it("prevents the last organization administrator from leaving", () => {
    expect(canLeaveOrganization(MembershipRole.MEMBER, 1)).toBe(true);
    expect(canLeaveOrganization(MembershipRole.MENTOR, 1)).toBe(true);
    expect(canLeaveOrganization(MembershipRole.ORG_ADMIN, 2)).toBe(true);
    expect(canLeaveOrganization(MembershipRole.ORG_ADMIN, 1)).toBe(false);
  });
});
