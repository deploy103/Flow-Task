import { MembershipRole, MembershipStatus } from "@prisma/client";

type RelationMember = {
  role: MembershipRole;
  status: MembershipStatus;
};

export function canAssignMentorRelation(mentor: RelationMember | undefined, mentee: RelationMember | undefined) {
  return mentor?.status === MembershipStatus.ACTIVE
    && mentor.role === MembershipRole.MENTOR
    && mentee?.status === MembershipStatus.ACTIVE
    && mentee.role === MembershipRole.MEMBER;
}
