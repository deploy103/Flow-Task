import {
  MembershipStatus,
  SystemRole,
  type AssignmentAudience,
  type MembershipStatus as MembershipStatusType,
  type SystemRole as SystemRoleType,
} from "@prisma/client";
import { canViewAssignment, isAssignmentPublished } from "@/features/assignment/visibility";

export function canDownloadChallengeResource(input: {
  archivedAt: Date | null;
  audience: AssignmentAudience;
  opensAt: Date;
  targetUserIds: string[];
  userId: string;
  systemRole: SystemRoleType;
  membershipStatus?: MembershipStatusType | null;
  canManage: boolean;
  canReview: boolean;
  now?: Date;
}) {
  if (input.archivedAt) return false;
  const active =
    input.systemRole === SystemRole.SYSTEM_ADMIN ||
    input.membershipStatus === MembershipStatus.ACTIVE;
  if (!active) return false;
  const privileged = input.canManage || input.canReview;
  if (
    !canViewAssignment({
      audience: input.audience,
      targetUserIds: input.targetUserIds,
      userId: input.userId,
      systemRole: input.systemRole,
      canManage: privileged,
    })
  ) return false;
  return privileged || isAssignmentPublished(input.opensAt, input.now);
}
