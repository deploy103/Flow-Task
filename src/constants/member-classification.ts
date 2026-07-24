import { ClubPosition, MentoringRole, SecurityTrack } from "@prisma/client";

export const CLUB_POSITION_LABELS: Record<ClubPosition, string> = {
  [ClubPosition.PRESIDENT]: "부장",
  [ClubPosition.VICE_PRESIDENT]: "차장",
  [ClubPosition.MEMBER]: "일반 부원",
};

export const SECURITY_TRACK_LABELS: Record<SecurityTrack, string> = {
  [SecurityTrack.PWNABLE]: "Pwnable",
  [SecurityTrack.WEB]: "Web",
  [SecurityTrack.FORENSICS]: "Forensics",
  [SecurityTrack.CRYPTOGRAPHY]: "Crypto",
  [SecurityTrack.REVERSING]: "Reversing",
  [SecurityTrack.MISCELLANEOUS]: "기타",
};

export const MENTORING_ROLE_LABELS: Record<MentoringRole, string> = {
  [MentoringRole.MENTOR]: "멘토",
  [MentoringRole.MENTEE]: "멘티",
  [MentoringRole.NONE]: "미참여",
};
