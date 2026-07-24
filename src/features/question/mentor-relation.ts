import { MembershipStatus, MentoringRole, type SecurityTrack } from "@prisma/client";

type RelationMember = {
  mentoringRole: MentoringRole;
  securityTrack: SecurityTrack | null;
  status: MembershipStatus;
};

export function canAssignMentorRelation(mentor: RelationMember | undefined, mentee: RelationMember | undefined) {
  return mentor?.status === MembershipStatus.ACTIVE
    && mentor.mentoringRole === MentoringRole.MENTOR
    && mentee?.status === MembershipStatus.ACTIVE
    && mentee.mentoringRole === MentoringRole.MENTEE
    && mentor.securityTrack !== null
    && mentor.securityTrack === mentee.securityTrack;
}
