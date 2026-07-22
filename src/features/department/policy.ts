import { MembershipRole, MembershipStatus, SystemRole } from "@prisma/client";

export function canAccessDepartment(input: { systemRole: SystemRole; organizationRole?: MembershipRole; organizationStatus?: MembershipStatus; isDepartmentMember: boolean }) {
  return input.systemRole === SystemRole.SYSTEM_ADMIN ||
    (input.organizationStatus === MembershipStatus.ACTIVE &&
      (input.organizationRole === MembershipRole.ORG_ADMIN || input.isDepartmentMember));
}
