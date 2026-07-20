import { ChallengeCategory, ExternalChallengeSource } from "@prisma/client";

export const MIN_CHALLENGE_FLAG_PEPPER_LENGTH = 32;
export const MAX_CHALLENGE_PLATFORM_LENGTH = 80;
export const MAX_CHALLENGE_TITLE_LENGTH = 160;
export const MAX_CHALLENGE_DESCRIPTION_LENGTH = 20_000;
export const MAX_CHALLENGE_URL_LENGTH = 2_048;
export const MAX_CHALLENGE_DIFFICULTY_LENGTH = 40;
export const MAX_CHALLENGE_POINTS = 100_000;
export const MAX_CHALLENGE_FLAG_LENGTH = 4_096;
export const MAX_CHALLENGE_FLAG_FORMAT_LENGTH = 160;
export const MAX_CHALLENGE_ATTEMPTS = 10_000;
export const MAX_CHALLENGE_PENALTY_PER_WRONG_ATTEMPT = MAX_CHALLENGE_POINTS;
export const MAX_CHALLENGE_WRITEUP_LENGTH = 50_000;

export const EXTERNAL_CHALLENGE_SOURCE_LABELS = {
  [ExternalChallengeSource.DREAMHACK]: "DreamHack",
  [ExternalChallengeSource.OTHER]: "기타 외부 플랫폼",
} satisfies Record<ExternalChallengeSource, string>;

export const CHALLENGE_CATEGORY_LABELS = {
  [ChallengeCategory.WEB]: "웹",
  [ChallengeCategory.SYSTEM]: "시스템",
  [ChallengeCategory.REVERSING]: "리버싱",
  [ChallengeCategory.FORENSICS]: "포렌식",
  [ChallengeCategory.CRYPTOGRAPHY]: "암호학",
  [ChallengeCategory.NETWORK]: "네트워크",
  [ChallengeCategory.PROGRAMMING]: "프로그래밍",
  [ChallengeCategory.OTHER]: "기타",
} satisfies Record<ChallengeCategory, string>;
