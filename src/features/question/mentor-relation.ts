import { MembershipStatus, MentoringRole, type SecurityTrack } from "@prisma/client";

export type RelationMember = {
  mentoringRole: MentoringRole;
  securityTrack: SecurityTrack | null;
  status: MembershipStatus;
};

type IdentifiedRelationMember = RelationMember & { userId: string };
type RelationReference = { mentorId: string; menteeId: string };

export function canAssignMentorRelation(mentor: RelationMember | undefined, mentee: RelationMember | undefined) {
  return mentor?.status === MembershipStatus.ACTIVE
    && mentor.mentoringRole === MentoringRole.MENTOR
    && mentee?.status === MembershipStatus.ACTIVE
    && mentee.mentoringRole === MentoringRole.MENTEE
    && mentor.securityTrack !== null
    && mentor.securityTrack === mentee.securityTrack;
}

export function getValidMentorId(
  relation: RelationReference | null | undefined,
  members: IdentifiedRelationMember[],
) {
  if (!relation) return null;
  const memberById = new Map(members.map((member) => [member.userId, member]));
  return canAssignMentorRelation(
    memberById.get(relation.mentorId),
    memberById.get(relation.menteeId),
  ) ? relation.mentorId : null;
}

export function getInvalidMentorRelationIds(
  relations: Array<RelationReference & { id: string }>,
  members: IdentifiedRelationMember[],
) {
  return relations
    .filter((relation) => getValidMentorId(relation, members) === null)
    .map((relation) => relation.id);
}
