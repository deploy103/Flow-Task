import { MembershipRole, MembershipStatus, SystemRole } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { canAccessDepartment } from "./policy";

describe("department access policy", () => {
  it("allows assigned active members and organization administrators", () => {
    expect(canAccessDepartment({ systemRole: SystemRole.USER, organizationRole: MembershipRole.MEMBER, organizationStatus: MembershipStatus.ACTIVE, isDepartmentMember: true })).toBe(true);
    expect(canAccessDepartment({ systemRole: SystemRole.USER, organizationRole: MembershipRole.ORG_ADMIN, organizationStatus: MembershipStatus.ACTIVE, isDepartmentMember: false })).toBe(true);
  });

  it("rejects unassigned and inactive organization members", () => {
    expect(canAccessDepartment({ systemRole: SystemRole.USER, organizationRole: MembershipRole.MEMBER, organizationStatus: MembershipStatus.ACTIVE, isDepartmentMember: false })).toBe(false);
    expect(canAccessDepartment({ systemRole: SystemRole.USER, organizationRole: MembershipRole.ORG_ADMIN, organizationStatus: MembershipStatus.INACTIVE, isDepartmentMember: true })).toBe(false);
  });

  it("allows system administrators", () => {
    expect(canAccessDepartment({ systemRole: SystemRole.SYSTEM_ADMIN, isDepartmentMember: false })).toBe(true);
  });
});
