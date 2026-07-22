import { QuizQuestionType, QuizResultRelease } from "@prisma/client";
import { z } from "zod";
import {
  MAX_QUIZ_ACCEPTED_ANSWERS,
  MAX_QUIZ_ATTEMPTS,
  MAX_QUIZ_CHOICE_LENGTH,
  MAX_QUIZ_CHOICES,
  MAX_QUIZ_DESCRIPTION_LENGTH,
  MAX_QUIZ_FEEDBACK_LENGTH,
  MAX_QUIZ_POINTS,
  MAX_QUIZ_PROMPT_LENGTH,
  MAX_QUIZ_RESPONSE_LENGTH,
  MAX_QUIZ_TAG_LENGTH,
  MAX_QUIZ_TAGS,
  MAX_QUIZ_TIME_LIMIT_MINUTES,
  MAX_QUIZ_TITLE_LENGTH,
} from "@/constants/quiz";
import { parseQuizChoices } from "./choice-format";

export { parseQuizChoices } from "./choice-format";

const checkbox = z.preprocess((value) => value === "on" || value === "true" || value === true, z.boolean());
const emptyToUndefined = (value: unknown) => typeof value === "string" && value.trim() === "" ? undefined : value ?? undefined;
const optionalInteger = (min: number, max: number) => z.preprocess(emptyToUndefined, z.coerce.number().int().min(min).max(max).optional());
const requiredInteger = (min: number, max: number) => z.preprocess(emptyToUndefined, z.coerce.number().int().min(min).max(max));
const optionalText = (max: number) => z.preprocess(emptyToUndefined, z.string().trim().min(1).max(max).optional());

export function parseQuizAnswerLines(value: string | undefined) {
  if (!value) return [];
  return [...new Set(value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean))];
}

export function parseQuizTags(value: string | undefined) {
  if (!value) return [];
  return [...new Set(value.split(",").map((tag) => tag.trim()).filter(Boolean))];
}

export const quizContextSchema = z.object({ organizationId: z.uuid(), assignmentId: z.uuid() });

export const createQuizSchema = quizContextSchema.extend({
  title: z.string().trim().min(1).max(MAX_QUIZ_TITLE_LENGTH),
  description: z.string().trim().min(1).max(MAX_QUIZ_DESCRIPTION_LENGTH),
  timeLimitMinutes: optionalInteger(1, MAX_QUIZ_TIME_LIMIT_MINUTES),
  attemptLimit: requiredInteger(1, MAX_QUIZ_ATTEMPTS),
  passingScore: optionalInteger(0, MAX_QUIZ_POINTS),
  shuffleQuestions: checkbox,
  shuffleChoices: checkbox,
  resultRelease: z.enum(Object.values(QuizResultRelease)),
});

export const createQuizQuestionSchema = quizContextSchema.extend({
  quizId: z.uuid(),
  type: z.enum(Object.values(QuizQuestionType)),
  prompt: z.string().trim().min(1).max(MAX_QUIZ_PROMPT_LENGTH),
  description: optionalText(MAX_QUIZ_DESCRIPTION_LENGTH),
  points: requiredInteger(0, MAX_QUIZ_POINTS),
  required: checkbox,
  difficulty: z.string().trim().min(1).max(40),
  tags: optionalText((MAX_QUIZ_TAG_LENGTH + 1) * MAX_QUIZ_TAGS),
  explanation: optionalText(MAX_QUIZ_DESCRIPTION_LENGTH),
  caseSensitive: checkbox,
  trimWhitespace: checkbox,
  choices: optionalText((MAX_QUIZ_CHOICE_LENGTH + 2) * MAX_QUIZ_CHOICES),
  acceptedAnswers: optionalText((MAX_QUIZ_RESPONSE_LENGTH + 2) * MAX_QUIZ_ACCEPTED_ANSWERS),
}).superRefine((data, context) => {
  const choices = parseQuizChoices(data.choices);
  const answers = parseQuizAnswerLines(data.acceptedAnswers);
  const tags = parseQuizTags(data.tags);
  if (choices.length > MAX_QUIZ_CHOICES || choices.some(({ content }) => !content || content.length > MAX_QUIZ_CHOICE_LENGTH)) context.addIssue({ code: "custom", path: ["choices"], message: "선택지 제한을 초과했습니다." });
  if (tags.length > MAX_QUIZ_TAGS || tags.some((tag) => tag.length > MAX_QUIZ_TAG_LENGTH)) context.addIssue({ code: "custom", path: ["tags"], message: "태그 제한을 초과했습니다." });
  if (data.type === QuizQuestionType.SINGLE_CHOICE || data.type === QuizQuestionType.MULTIPLE_CHOICE) {
    const correct = choices.filter(({ isCorrect }) => isCorrect).length;
    if (choices.length < 2 || correct < 1 || (data.type === QuizQuestionType.SINGLE_CHOICE && correct !== 1)) context.addIssue({ code: "custom", path: ["choices"], message: "선택지와 정답 표시를 확인해 주세요." });
  } else if (choices.length) context.addIssue({ code: "custom", path: ["choices"], message: "선택형 문제에만 선택지를 설정할 수 있습니다." });
  if (data.type === QuizQuestionType.SHORT_TEXT || data.type === QuizQuestionType.FLAG) {
    if (!answers.length || answers.length > MAX_QUIZ_ACCEPTED_ANSWERS) context.addIssue({ code: "custom", path: ["acceptedAnswers"], message: "정답을 입력해 주세요." });
  } else if (answers.length) context.addIssue({ code: "custom", path: ["acceptedAnswers"], message: "단답형과 플래그에만 정답을 설정할 수 있습니다." });
});

export const reuseQuizQuestionSchema = quizContextSchema.extend({ quizId: z.uuid(), questionId: z.uuid() });
export const startQuizSchema = quizContextSchema.extend({ quizId: z.uuid() });
export const attemptContextSchema = quizContextSchema.extend({ quizId: z.uuid(), attemptId: z.uuid() });
export const saveQuizAnswerSchema = attemptContextSchema.extend({
  questionId: z.uuid(),
  value: z.string().max(MAX_QUIZ_RESPONSE_LENGTH).optional(),
  selectedChoiceIds: z.array(z.uuid()).max(MAX_QUIZ_CHOICES).default([]),
});
export const gradeQuizAnswerSchema = quizContextSchema.extend({
  quizId: z.uuid(),
  attemptId: z.uuid(),
  answerId: z.uuid(),
  score: requiredInteger(0, MAX_QUIZ_POINTS),
  feedback: optionalText(MAX_QUIZ_FEEDBACK_LENGTH),
});
