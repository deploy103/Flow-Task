import { MembershipRole } from "@prisma/client";

export const MEMBERSHIP_ROLE_LABELS: Record<MembershipRole, string> = {
  [MembershipRole.MEMBER]: "부원",
  [MembershipRole.MENTOR]: "멘토",
  [MembershipRole.ORG_ADMIN]: "조직 관리자",
};

export const MEMBERSHIP_ROLE_DESCRIPTIONS: Record<MembershipRole, string> = {
  [MembershipRole.MEMBER]: "공지·과제·퀴즈에 참여하는 일반 부원",
  [MembershipRole.MENTOR]: "제출물 검토·채점과 멘토 질문을 담당",
  [MembershipRole.ORG_ADMIN]: "조직 설정·초대·역할과 전체 콘텐츠를 관리",
};
