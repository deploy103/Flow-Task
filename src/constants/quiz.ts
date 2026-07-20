import { QuizQuestionType, QuizResultRelease } from "@prisma/client";

export const MAX_QUIZ_TITLE_LENGTH = 160;
export const MAX_QUIZ_DESCRIPTION_LENGTH = 20_000;
export const MAX_QUIZ_TIME_LIMIT_MINUTES = 1_440;
export const MAX_QUIZ_ATTEMPTS = 100;
export const MAX_QUIZ_POINTS = 100_000;
export const MAX_QUIZ_TOTAL_POINTS = 1_000_000;
export const MAX_QUIZ_PROMPT_LENGTH = 20_000;
export const MAX_QUIZ_CHOICE_LENGTH = 1_000;
export const MAX_QUIZ_CHOICES = 20;
export const MAX_QUIZ_ACCEPTED_ANSWERS = 20;
export const MAX_QUIZ_RESPONSE_LENGTH = 50_000;
export const MAX_QUIZ_FEEDBACK_LENGTH = 20_000;
export const MAX_QUIZ_TAGS = 10;
export const MAX_QUIZ_TAG_LENGTH = 40;
export const MAX_QUIZ_FILE_BYTES = 512 * 1024;
export const QUIZ_AUTOSAVE_DELAY_MILLISECONDS = 800;

export const QUIZ_QUESTION_TYPE_LABELS = {
  [QuizQuestionType.SINGLE_CHOICE]: "객관식 단일 선택",
  [QuizQuestionType.MULTIPLE_CHOICE]: "객관식 복수 선택",
  [QuizQuestionType.SHORT_TEXT]: "단답형",
  [QuizQuestionType.LONG_TEXT]: "서술형",
  [QuizQuestionType.FLAG]: "플래그 입력",
  [QuizQuestionType.FILE]: "파일 제출",
} satisfies Record<QuizQuestionType, string>;

export const QUIZ_RESULT_RELEASE_LABELS = {
  [QuizResultRelease.IMMEDIATE]: "제출 즉시 (자동 채점 완료 시)",
  [QuizResultRelease.AFTER_DEADLINE]: "과제 마감 후",
  [QuizResultRelease.AFTER_GRADING]: "관리자 채점 완료 후",
  [QuizResultRelease.HIDDEN]: "공개하지 않음",
} satisfies Record<QuizResultRelease, string>;
