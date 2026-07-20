"use client";

import { QuizQuestionType } from "@prisma/client";
import { useActionState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { QUIZ_AUTOSAVE_DELAY_MILLISECONDS } from "@/constants/quiz";
import { saveQuizAnswer, type QuizSaveState } from "../attempt-actions";

const initialState: QuizSaveState = { status: "idle" };

export function QuizAnswerForm({
  context,
  type,
  choices,
  defaultText,
  selectedChoiceIds,
  existingFilename,
}: {
  context: { organizationId: string; assignmentId: string; quizId: string; attemptId: string; questionId: string };
  type: QuizQuestionType;
  choices: { id: string; content: string }[];
  defaultText?: string;
  selectedChoiceIds: string[];
  existingFilename?: string;
}) {
  const [state, action, pending] = useActionState(saveQuizAnswer, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);
  const schedule = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => formRef.current?.requestSubmit(), QUIZ_AUTOSAVE_DELAY_MILLISECONDS);
  };
  return (
    <form action={action} className="mt-4" onChange={schedule} ref={formRef}>
      {Object.entries(context).map(([name, value]) => <input key={name} name={name} type="hidden" value={value} />)}
      {(type === QuizQuestionType.SINGLE_CHOICE || type === QuizQuestionType.MULTIPLE_CHOICE) && <div className="space-y-2">{choices.map((choice) => <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-3 text-sm dark:border-slate-700" key={choice.id}><input defaultChecked={selectedChoiceIds.includes(choice.id)} name="selectedChoiceIds" type={type === QuizQuestionType.SINGLE_CHOICE ? "radio" : "checkbox"} value={choice.id} /><span>{choice.content}</span></label>)}</div>}
      {(type === QuizQuestionType.SHORT_TEXT || type === QuizQuestionType.FLAG) && <Input autoComplete="off" defaultValue={type === QuizQuestionType.FLAG ? "" : defaultText} name="value" placeholder={type === QuizQuestionType.FLAG ? "플래그 입력" : "답변 입력"} type={type === QuizQuestionType.FLAG ? "password" : "text"} />}
      {type === QuizQuestionType.LONG_TEXT && <textarea className="min-h-36 w-full rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900" defaultValue={defaultText} maxLength={50_000} name="value" />}
      {type === QuizQuestionType.FILE && <div><Input accept=".pdf,.hwp,.hwpx,.docx,.pptx,.xlsx,.zip,.png,.jpg,.jpeg" name="file" type="file" />{existingFilename && <p className="mt-2 text-xs text-slate-500">현재 저장 파일: {existingFilename}</p>}</div>}
      <p aria-live="polite" className={state.status === "error" ? "mt-2 text-xs font-semibold text-red-600" : "mt-2 text-xs text-slate-500"}>{pending ? "저장 중…" : state.status === "saved" ? "자동 저장됨" : state.status === "error" ? "자동 저장 실패 — 입력을 확인해 주세요." : "입력 후 자동 저장됩니다."}</p>
    </form>
  );
}
