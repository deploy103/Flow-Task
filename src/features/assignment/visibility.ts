import { AssignmentAudience, SystemRole, type SystemRole as SystemRoleType } from "@prisma/client";

type AssignmentVisibilityInput = {
  audience: AssignmentAudience;
  targetUserIds: string[];
  userId: string;
  systemRole: SystemRoleType;
  canManage: boolean;
};

export function canViewAssignment(input: AssignmentVisibilityInput) {
  if (input.systemRole === SystemRole.SYSTEM_ADMIN || input.canManage) return true;
  if (input.audience === AssignmentAudience.ALL_MEMBERS) return true;
  return input.targetUserIds.includes(input.userId);
}

export function isAssignmentPublished(opensAt: Date, now = new Date()) {
  return opensAt <= now;
}
