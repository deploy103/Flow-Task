import { QuizAttemptStatus } from "@prisma/client";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { QUIZ_QUESTION_TYPE_LABELS } from "@/constants/quiz";
import { requireOrganizationAccess } from "@/features/organization/guards";
import { submitQuizAttempt } from "@/features/quiz/attempt-actions";
import { QuizAnswerForm } from "@/features/quiz/components/answer-form";
import { QuizTimer } from "@/features/quiz/components/timer";
import { prisma } from "@/lib/prisma";

const ERRORS: Record<string, string> = { required_missing: "필수 문항에 응답하지 않았습니다.", attempt_expired: "제한 시간이 끝났습니다. 자동 제출을 기다려 주세요.", submit_failed: "제출에 실패했습니다.", attempt_closed: "이미 종료된 응시입니다." };

function stringArray(value: unknown) { return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []; }
function responseText(value: unknown) { return value && typeof value === "object" && "text" in value && typeof value.text === "string" ? value.text : ""; }
function responseChoices(value: unknown) { return value && typeof value === "object" && "choiceIds" in value ? stringArray(value.choiceIds) : []; }

export default async function QuizAttemptPage({ params, searchParams }: { params: Promise<{ organizationId: string; assignmentId: string; quizId: string; attemptId: string }>; searchParams: Promise<{ error?: string }> }) {
  const [{ organizationId, assignmentId, quizId, attemptId }, query] = await Promise.all([params, searchParams]);
  const { user } = await requireOrganizationAccess(organizationId);
  const attempt = await prisma.quizAttempt.findFirst({
    where: { id: attemptId, quizId, userId: user.id, quiz: { assignmentItem: { assignmentId, assignment: { organizationId, archivedAt: null } } } },
    select: {
      status: true,
      attemptNumber: true,
      expiresAt: true,
      questionOrder: true,
      choiceOrder: true,
      quiz: { select: { title: true, questions: { orderBy: { position: "asc" }, select: { question: { select: { id: true, type: true, prompt: true, description: true, points: true, required: true, choices: { orderBy: { position: "asc" }, select: { id: true, content: true } } } } } } } },
      answers: { select: { questionId: true, response: true, file: { select: { originalFilename: true } } } },
    },
  });
  if (!attempt) notFound();
  if (attempt.status !== QuizAttemptStatus.IN_PROGRESS) redirect(`/organizations/${organizationId}/assignments/${assignmentId}/quiz/${quizId}`);
  const byId = new Map(attempt.quiz.questions.map(({ question }) => [question.id, question]));
  const order = stringArray(attempt.questionOrder).filter((id) => byId.has(id));
  const choiceOrder = attempt.choiceOrder && typeof attempt.choiceOrder === "object" && !Array.isArray(attempt.choiceOrder) ? attempt.choiceOrder as Record<string, unknown> : {};
  const answers = new Map(attempt.answers.map((answer) => [answer.questionId, answer]));
  const context = { organizationId, assignmentId, quizId, attemptId };
  return <div className="max-w-4xl"><div className="flex flex-wrap items-center justify-between gap-3"><Link className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500" href={`/organizations/${organizationId}/assignments/${assignmentId}/quiz/${quizId}`}><ArrowLeft size={17} /> 퀴즈로 돌아가기</Link>{attempt.expiresAt && <QuizTimer context={context} expiresAt={attempt.expiresAt.toISOString()} />}</div><h1 className="mt-4 text-3xl font-bold">{attempt.quiz.title}</h1><p className="mt-1 text-sm text-slate-500">{attempt.attemptNumber}회차 · 입력 내용은 문항별로 자동 저장됩니다.</p>{query.error && ERRORS[query.error] && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{ERRORS[query.error]}</p>}<div className="mt-6 space-y-5">{order.map((questionId, index) => { const question = byId.get(questionId)!; const answer = answers.get(questionId); const orderedChoiceIds = stringArray(choiceOrder[questionId]); const choiceMap = new Map(question.choices.map((choice) => [choice.id, choice])); const choices = orderedChoiceIds.map((id) => choiceMap.get(id)).filter((choice): choice is { id: string; content: string } => Boolean(choice)); for (const choice of question.choices) if (!choices.some(({ id }) => id === choice.id)) choices.push(choice); return <Card key={question.id}><div className="flex flex-wrap justify-between gap-2"><div><p className="text-xs font-semibold text-slate-500">문제 {index + 1} · {QUIZ_QUESTION_TYPE_LABELS[question.type]} {question.required ? "· 필수" : ""}</p><h2 className="mt-2 text-lg font-bold">{question.prompt}</h2></div><strong className="text-indigo-600">{question.points}점</strong></div>{question.description && <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600 dark:text-slate-300">{question.description}</p>}<QuizAnswerForm choices={choices} context={{ ...context, questionId: question.id }} defaultText={responseText(answer?.response)} existingFilename={answer?.file?.originalFilename} selectedChoiceIds={responseChoices(answer?.response)} type={question.type} /></Card>; })}</div><Card className="mt-6"><h2 className="font-bold">최종 제출</h2><p className="mt-1 text-sm text-slate-500">자동 저장이 완료됐는지 확인하세요. 제출 후에는 답안을 수정할 수 없습니다.</p><form action={submitQuizAttempt} className="mt-4">{Object.entries(context).map(([name, value]) => <input key={name} name={name} type="hidden" value={value} />)}<Button type="submit">퀴즈 최종 제출</Button></form></Card></div>;
}
