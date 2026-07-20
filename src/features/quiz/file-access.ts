import { MembershipStatus, SystemRole, type MembershipStatus as MembershipStatusType, type SystemRole as SystemRoleType } from "@prisma/client";

export function canDownloadQuizAnswerFile(input: { userId: string; ownerId: string; systemRole: SystemRoleType; membershipStatus?: MembershipStatusType | null; canReview: boolean; archivedAt: Date | null }) {
  if (input.archivedAt) return false;
  if (input.systemRole === SystemRole.SYSTEM_ADMIN) return true;
  if (input.membershipStatus !== MembershipStatus.ACTIVE) return false;
  return input.userId === input.ownerId || input.canReview;
}
