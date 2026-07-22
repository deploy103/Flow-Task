"use client";

import { QuizQuestionType } from "@prisma/client";
import { Plus, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  MAX_QUIZ_ACCEPTED_ANSWERS,
  MAX_QUIZ_CHOICES,
  MAX_QUIZ_CHOICE_LENGTH,
  MAX_QUIZ_DESCRIPTION_LENGTH,
  MAX_QUIZ_POINTS,
  MAX_QUIZ_PROMPT_LENGTH,
  MAX_QUIZ_RESPONSE_LENGTH,
  MAX_QUIZ_TAG_LENGTH,
  MAX_QUIZ_TAGS,
  QUIZ_QUESTION_TYPE_DESCRIPTIONS,
  QUIZ_QUESTION_TYPE_LABELS,
} from "@/constants/quiz";
import { createQuizQuestion } from "@/features/quiz/admin-actions";
import { serializeQuizChoices } from "@/features/quiz/choice-format";

type ChoiceDraft = { id: number; content: string; isCorrect: boolean };
type AnswerDraft = { id: number; content: string };

const choiceTypes = new Set<QuizQuestionType>([
  QuizQuestionType.SINGLE_CHOICE,
  QuizQuestionType.MULTIPLE_CHOICE,
]);
const automaticTextTypes = new Set<QuizQuestionType>([
  QuizQuestionType.SHORT_TEXT,
  QuizQuestionType.FLAG,
]);

export function QuizQuestionBuilderForm({
  organizationId,
  assignmentId,
  quizId,
}: {
  organizationId: string;
  assignmentId: string;
  quizId: string;
}) {
  const [type, setType] = useState<QuizQuestionType>(QuizQuestionType.SINGLE_CHOICE);
  const [choices, setChoices] = useState<ChoiceDraft[]>([
    { id: 0, content: "", isCorrect: true },
    { id: 1, content: "", isCorrect: false },
  ]);
  const [answers, setAnswers] = useState<AnswerDraft[]>([{ id: 0, content: "" }]);
  const nextChoiceId = useRef(2);
  const nextAnswerId = useRef(1);
  const usesChoices = choiceTypes.has(type);
  const usesAutomaticTextAnswers = automaticTextTypes.has(type);

  const changeType = (nextType: QuizQuestionType) => {
    setType(nextType);
    if (nextType === QuizQuestionType.SINGLE_CHOICE) {
      setChoices((current) => {
        const selectedId = current.find((choice) => choice.isCorrect)?.id ?? current[0]?.id;
        return current.map((choice) => ({ ...choice, isCorrect: choice.id === selectedId }));
      });
    }
  };

  const updateChoice = (id: number, content: string) => {
    setChoices((current) => current.map((choice) => choice.id === id ? { ...choice, content } : choice));
  };

  const markChoice = (id: number, checked: boolean) => {
    setChoices((current) => current.map((choice) => ({
      ...choice,
      isCorrect: type === QuizQuestionType.SINGLE_CHOICE
        ? choice.id === id
        : choice.id === id ? checked : choice.isCorrect,
    })));
  };

  const addChoice = () => {
    if (choices.length >= MAX_QUIZ_CHOICES) return;
    const id = nextChoiceId.current++;
    setChoices((current) => [...current, { id, content: "", isCorrect: false }]);
  };

  const removeChoice = (id: number) => {
    if (choices.length <= 2) return;
    setChoices((current) => {
      const removed = current.find((choice) => choice.id === id);
      const remaining = current.filter((choice) => choice.id !== id);
      if (type === QuizQuestionType.SINGLE_CHOICE && removed?.isCorrect && remaining[0]) {
        return remaining.map((choice, index) => ({ ...choice, isCorrect: index === 0 }));
      }
      return remaining;
    });
  };

  const addAnswer = () => {
    if (answers.length >= MAX_QUIZ_ACCEPTED_ANSWERS) return;
    const id = nextAnswerId.current++;
    setAnswers((current) => [...current, { id, content: "" }]);
  };

  const serializedChoices = usesChoices
    ? serializeQuizChoices(choices)
    : "";
  const serializedAnswers = usesAutomaticTextAnswers
    ? answers.map((answer) => answer.content).join("\n")
    : "";

  return (
    <form action={createQuizQuestion} className="mt-5 space-y-5">
      <input name="organizationId" type="hidden" value={organizationId} />
      <input name="assignmentId" type="hidden" value={assignmentId} />
      <input name="quizId" type="hidden" value={quizId} />
      <input name="choices" type="hidden" value={serializedChoices} />
      <input name="acceptedAnswers" type="hidden" value={serializedAnswers} />

      <label className="block text-sm font-semibold">
        문제 유형
        <select
          className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50"
          name="type"
          onChange={(event) => changeType(event.target.value as QuizQuestionType)}
          value={type}
        >
          {Object.values(QuizQuestionType).map((questionType) => (
            <option key={questionType} value={questionType}>{QUIZ_QUESTION_TYPE_LABELS[questionType]}</option>
          ))}
        </select>
        <span className="mt-2 block text-xs font-normal leading-5 text-slate-500">
          {QUIZ_QUESTION_TYPE_DESCRIPTIONS[type]}
        </span>
      </label>

      <label className="block text-sm font-semibold">
        질문
        <textarea
          className="mt-2 min-h-28 w-full rounded-xl border border-slate-200 bg-white p-3 text-slate-900 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50"
          maxLength={MAX_QUIZ_PROMPT_LENGTH}
          name="prompt"
          placeholder="학생에게 보여줄 질문을 입력하세요."
          required
        />
      </label>

      {usesChoices && (
        <fieldset className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
          <legend className="px-2 text-sm font-bold">선택지와 정답</legend>
          <p className="mb-4 text-xs leading-5 text-slate-500">
            왼쪽 {type === QuizQuestionType.SINGLE_CHOICE ? "동그라미" : "체크박스"}로 정답을 표시하세요. 별표 같은 특별한 표시는 필요 없습니다.
          </p>
          <div className="space-y-3">
            {choices.map((choice, index) => (
              <div className="flex items-center gap-2" key={choice.id}>
                <input
                  aria-label={`${index + 1}번 선택지를 정답으로 지정`}
                  checked={choice.isCorrect}
                  name="correctChoicePreview"
                  onChange={(event) => markChoice(choice.id, event.target.checked)}
                  type={type === QuizQuestionType.SINGLE_CHOICE ? "radio" : "checkbox"}
                />
                <Input
                  aria-label={`${index + 1}번 선택지`}
                  maxLength={MAX_QUIZ_CHOICE_LENGTH}
                  onChange={(event) => updateChoice(choice.id, event.target.value)}
                  placeholder={`선택지 ${index + 1}`}
                  required
                  value={choice.content}
                />
                <button
                  aria-label={`${index + 1}번 선택지 삭제`}
                  className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30 dark:hover:bg-red-950/40"
                  disabled={choices.length <= 2}
                  onClick={() => removeChoice(choice.id)}
                  type="button"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
          </div>
          <button
            className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-indigo-600 hover:bg-indigo-50 disabled:opacity-40 dark:hover:bg-indigo-950/40"
            disabled={choices.length >= MAX_QUIZ_CHOICES}
            onClick={addChoice}
            type="button"
          >
            <Plus size={17} /> 선택지 추가
          </button>
        </fieldset>
      )}

      {usesAutomaticTextAnswers && (
        <fieldset className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
          <legend className="px-2 text-sm font-bold">정답</legend>
          <p className="mb-4 text-xs leading-5 text-slate-500">정답으로 인정할 표현을 입력하세요. 표현이 여러 개라면 정답 예시를 추가할 수 있습니다.</p>
          <div className="space-y-3">
            {answers.map((answer, index) => (
              <div className="flex items-center gap-2" key={answer.id}>
                <Input
                  aria-label={`${index + 1}번째 정답 예시`}
                  autoComplete="off"
                  maxLength={MAX_QUIZ_RESPONSE_LENGTH}
                  onChange={(event) => setAnswers((current) => current.map((item) => item.id === answer.id ? { ...item, content: event.target.value } : item))}
                  placeholder={type === QuizQuestionType.FLAG ? "예: CTF{answer}" : "정답 예시"}
                  required
                  type={type === QuizQuestionType.FLAG ? "password" : "text"}
                  value={answer.content}
                />
                <button
                  aria-label={`${index + 1}번째 정답 예시 삭제`}
                  className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30 dark:hover:bg-red-950/40"
                  disabled={answers.length <= 1}
                  onClick={() => setAnswers((current) => current.filter((item) => item.id !== answer.id))}
                  type="button"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
          </div>
          <button
            className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-indigo-600 hover:bg-indigo-50 disabled:opacity-40 dark:hover:bg-indigo-950/40"
            disabled={answers.length >= MAX_QUIZ_ACCEPTED_ANSWERS}
            onClick={addAnswer}
            type="button"
          >
            <Plus size={17} /> 정답 예시 추가
          </button>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-800"><input name="caseSensitive" type="checkbox" /> 대소문자 구분</label>
            <label className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-800"><input defaultChecked name="trimWhitespace" type="checkbox" /> 앞뒤 공백 무시</label>
          </div>
        </fieldset>
      )}

      {!usesChoices && !usesAutomaticTextAnswers && (
        <div className="rounded-xl bg-sky-50 p-4 text-sm text-sky-800 dark:bg-sky-950/50 dark:text-sky-200">
          이 유형은 자동 정답을 설정하지 않습니다. 학생 답변은 제출 후 관리자가 직접 검토하고 채점합니다.
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-semibold">배점<Input className="mt-2" defaultValue={1} max={MAX_QUIZ_POINTS} min={0} name="points" required type="number" /></label>
        <label className="flex items-center gap-3 self-end rounded-xl bg-slate-50 p-3 text-sm font-medium dark:bg-slate-800"><input defaultChecked name="required" type="checkbox" /> 필수 문항</label>
      </div>

      <details className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
        <summary className="cursor-pointer text-sm font-bold">고급 설정</summary>
        <div className="mt-4 space-y-4">
          <label className="block text-sm">질문 추가 설명<textarea className="mt-2 min-h-20 w-full rounded-xl border border-slate-200 bg-white p-3 text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50" maxLength={MAX_QUIZ_DESCRIPTION_LENGTH} name="description" /></label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">난이도<Input className="mt-2" defaultValue="보통" maxLength={40} name="difficulty" required /></label>
            <label className="text-sm">태그 <span className="text-slate-400">(쉼표로 구분)</span><Input className="mt-2" maxLength={(MAX_QUIZ_TAG_LENGTH + 1) * MAX_QUIZ_TAGS} name="tags" /></label>
          </div>
          <label className="block text-sm">정답 해설<textarea className="mt-2 min-h-20 w-full rounded-xl border border-slate-200 bg-white p-3 text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50" maxLength={MAX_QUIZ_DESCRIPTION_LENGTH} name="explanation" /></label>
        </div>
      </details>

      <Button type="submit">문항 만들고 퀴즈에 추가</Button>
    </form>
  );
}
