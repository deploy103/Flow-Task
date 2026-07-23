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
  [QuizQuestionType.SINGLE_CHOICE]: "객관식 (정답 1개)",
  [QuizQuestionType.MULTIPLE_CHOICE]: "체크박스 (정답 여러 개)",
  [QuizQuestionType.SHORT_TEXT]: "단답형",
  [QuizQuestionType.LONG_TEXT]: "서술형",
  [QuizQuestionType.FLAG]: "플래그 입력",
  [QuizQuestionType.FILE]: "파일 제출",
} satisfies Record<QuizQuestionType, string>;

export const QUIZ_QUESTION_TYPE_DESCRIPTIONS = {
  [QuizQuestionType.SINGLE_CHOICE]: "여러 선택지 중 하나를 고릅니다. 정답 하나를 표시하세요.",
  [QuizQuestionType.MULTIPLE_CHOICE]: "여러 선택지를 고를 수 있습니다. 정답을 하나 이상 표시하세요.",
  [QuizQuestionType.SHORT_TEXT]: "짧은 답을 입력합니다. 인정할 정답 표현을 등록하세요.",
  [QuizQuestionType.LONG_TEXT]: "긴 글로 답합니다. 관리자가 제출 후 직접 채점합니다.",
  [QuizQuestionType.FLAG]: "CTF 플래그를 입력하고 서버가 자동으로 채점합니다.",
  [QuizQuestionType.FILE]: "파일을 제출합니다. 관리자가 제출 후 직접 채점합니다.",
} satisfies Record<QuizQuestionType, string>;

export const QUIZ_RESULT_RELEASE_LABELS = {
  [QuizResultRelease.IMMEDIATE]: "제출 즉시 (자동 채점 완료 시)",
  [QuizResultRelease.AFTER_DEADLINE]: "과제 마감 후",
  [QuizResultRelease.AFTER_GRADING]: "관리자 채점 완료 후",
  [QuizResultRelease.HIDDEN]: "공개하지 않음",
} satisfies Record<QuizResultRelease, string>;
