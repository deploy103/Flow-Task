import {
  AssignmentAudience,
  MembershipRole,
  MembershipStatus,
  SystemRole,
  type MembershipRole as MembershipRoleType,
  type MembershipStatus as MembershipStatusType,
  type SystemRole as SystemRoleType,
} from "@prisma/client";

type SubmissionAccessInput = {
  audience: AssignmentAudience;
  targetUserIds: string[];
  userId: string;
  membershipStatus?: MembershipStatusType | null;
};

export function canSubmitAssignment(input: SubmissionAccessInput) {
  if (input.membershipStatus !== MembershipStatus.ACTIVE) return false;
  return (
    input.audience === AssignmentAudience.ALL_MEMBERS || input.targetUserIds.includes(input.userId)
  );
}

export function canDownloadSubmissionFile(input: {
  isOwner: boolean;
  systemRole: SystemRoleType;
  membership?: { role: MembershipRoleType; status: MembershipStatusType } | null;
}) {
  if (input.systemRole === SystemRole.SYSTEM_ADMIN) return true;
  if (input.membership?.status !== MembershipStatus.ACTIVE) return false;
  return input.isOwner || input.membership.role === MembershipRole.ORG_ADMIN;
}
