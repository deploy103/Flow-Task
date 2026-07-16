import { MembershipRole, MembershipStatus, SystemRole } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { canManageOrganization, canViewOrganization } from "./permissions";

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
});
