import { MembershipRole } from "@prisma/client";

export const MEMBERSHIP_ROLE_LABELS: Record<MembershipRole, string> = {
  [MembershipRole.MEMBER]: "부원",
  [MembershipRole.MENTOR]: "멘토",
  [MembershipRole.ORG_ADMIN]: "조직 관리자",
};
