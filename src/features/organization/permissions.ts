import { MembershipRole, MembershipStatus, SystemRole } from "@prisma/client";

type PermissionContext = {
  systemRole: SystemRole;
  membership?: { role: MembershipRole; status: MembershipStatus } | null;
};

export function canManageOrganization(context: PermissionContext) {
  return (
    context.systemRole === SystemRole.SYSTEM_ADMIN ||
    (context.membership?.status === MembershipStatus.ACTIVE &&
      context.membership.role === MembershipRole.ORG_ADMIN)
  );
}

export function canViewOrganization(context: PermissionContext) {
  return (
    context.systemRole === SystemRole.SYSTEM_ADMIN ||
    context.membership?.status === MembershipStatus.ACTIVE
  );
}

export function canReviewSubmissions(context: PermissionContext) {
  return (
    context.systemRole === SystemRole.SYSTEM_ADMIN ||
    (context.membership?.status === MembershipStatus.ACTIVE &&
      (context.membership.role === MembershipRole.ORG_ADMIN ||
        context.membership.role === MembershipRole.MENTOR))
  );
}

export function canLeaveOrganization(role: MembershipRole, activeAdministratorCount: number) {
  return role !== MembershipRole.ORG_ADMIN || activeAdministratorCount > 1;
}
