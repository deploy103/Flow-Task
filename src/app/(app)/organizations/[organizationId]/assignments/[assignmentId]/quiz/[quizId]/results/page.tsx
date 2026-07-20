import { QuizQuestionType } from "@prisma/client";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { QUIZ_QUESTION_TYPE_LABELS } from "@/constants/quiz";
import { requireOrganizationAccess } from "@/features/organization/guards";
import { canReviewSubmissions } from "@/features/organization/permissions";
import { gradeQuizAnswer } from "@/features/quiz/attempt-actions";
import { formatKoreanDateTime } from "@/lib/date";
import { prisma } from "@/lib/prisma";

function answerText(
  type: QuizQuestionType,
  response: unknown,
  choices: { id: string; content: string }[],
) {
  if (!response || typeof response !== "object") return "-";
  if (type === QuizQuestionType.FLAG) return "플래그 제출됨 (원문 비저장)";
  if ("text" in response && typeof response.text === "string")
    return response.text;
  if ("choiceIds" in response && Array.isArray(response.choiceIds)) {
    const ids = response.choiceIds.filter(
      (value): value is string => typeof value === "string",
    );
    return (
      choices
        .filter(({ id }) => ids.includes(id))
        .map(({ content }) => content)
        .join(", ") || "-"
    );
  }
  if ("file" in response) return "파일 제출";
  return "-";
}

export default async function QuizResultsPage({
  params,
  searchParams,
}: {
  params: Promise<{
    organizationId: string;
    assignmentId: string;
    quizId: string;
  }>;
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const [{ organizationId, assignmentId, quizId }, query] = await Promise.all([
    params,
    searchParams,
  ]);
  const { user, membership } = await requireOrganizationAccess(organizationId);
  if (!canReviewSubmissions({ systemRole: user.systemRole, membership }))
    notFound();
  const quiz = await prisma.quiz.findFirst({
    where: {
      assignmentItemId: quizId,
      assignmentItem: {
        assignmentId,
        assignment: { organizationId, archivedAt: null },
      },
    },
    select: {
      title: true,
      attempts: {
        orderBy: [{ submittedAt: "desc" }, { startedAt: "desc" }],
        select: {
          id: true,
          attemptNumber: true,
          status: true,
          startedAt: true,
          submittedAt: true,
          autoSubmitted: true,
          score: true,
          maxScore: true,
            passed: true,
            integrityEvents: { select: { type: true } },
          user: { select: { name: true, email: true } },
          answers: {
            orderBy: { question: { createdAt: "asc" } },
            select: {
              id: true,
              response: true,
              score: true,
              feedback: true,
              file: { select: { originalFilename: true } },
              question: {
                select: {
                  type: true,
                  prompt: true,
                  points: true,
                  choices: { select: { id: true, content: true } },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!quiz) notFound();
  const completed = quiz.attempts.filter(
    ({ status }) => status !== "IN_PROGRESS",
  );
  const graded = completed.filter(({ score }) => score !== null);
  const average = graded.length
    ? graded.reduce((total, attempt) => total + (attempt.score ?? 0), 0) /
      graded.length
    : null;
  return (
    <div className="max-w-5xl">
      <Link
        className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500"
        href={`/organizations/${organizationId}/assignments/${assignmentId}/quiz/${quizId}`}
      >
        <ArrowLeft size={17} /> 퀴즈로 돌아가기
      </Link>
      <h1 className="mt-4 text-3xl font-bold">{quiz.title} 결과</h1>
      {query.error && (
        <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">
          채점 저장에 실패했습니다.
        </p>
      )}
      {query.success && (
        <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">
          채점을 저장했습니다.
        </p>
      )}
      <Card className="mt-6">
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <p className="text-xs text-slate-500">전체 응시</p>
            <strong>{quiz.attempts.length}회</strong>
          </div>
          <div>
            <p className="text-xs text-slate-500">제출 완료</p>
            <strong>{completed.length}회</strong>
          </div>
          <div>
            <p className="text-xs text-slate-500">평균 점수</p>
            <strong>{average === null ? "-" : average.toFixed(1)}</strong>
          </div>
        </div>
      </Card>
      <div className="mt-5 space-y-5">
        {quiz.attempts.map((attempt) => (
          <Card key={attempt.id}>
            <div className="flex flex-wrap justify-between gap-3">
              <div>
                <strong>
                  {attempt.user.name} · {attempt.attemptNumber}회차
                </strong>
                <p className="mt-1 text-xs text-slate-500">
                  {attempt.user.email} · 시작{" "}
                  {formatKoreanDateTime(attempt.startedAt)} · 제출{" "}
                  {attempt.submittedAt
                    ? formatKoreanDateTime(attempt.submittedAt)
                    : "-"}
                </p>
              </div>
              <strong className="text-indigo-600">
                {attempt.status}
                {attempt.autoSubmitted ? " · 자동 제출" : ""} ·{" "}
                {attempt.score ?? "-"}/{attempt.maxScore}
              </strong>
            </div>
            <p className="mt-3 text-xs text-slate-500">
              참고 기록 · 창 이탈 {attempt.integrityEvents.filter(({ type }) => type === "TAB_HIDDEN" || type === "WINDOW_BLUR").length}회 · 복사/붙여넣기 {attempt.integrityEvents.filter(({ type }) => type === "COPY" || type === "PASTE").length}회 · IP 변경 {attempt.integrityEvents.filter(({ type }) => type === "IP_CHANGED").length}회
            </p>
            <div className="mt-4 space-y-3">
              {attempt.answers.map((answer) => {
                const manual =
                  answer.question.type === QuizQuestionType.LONG_TEXT ||
                  answer.question.type === QuizQuestionType.FILE;
                return (
                  <div
                    className="rounded-xl bg-slate-50 p-4 text-sm dark:bg-slate-800"
                    key={answer.id}
                  >
                    <div className="flex flex-wrap justify-between gap-2">
                      <strong>{answer.question.prompt}</strong>
                      <span>
                        {QUIZ_QUESTION_TYPE_LABELS[answer.question.type]} ·{" "}
                        {answer.score ?? "미채점"}/{answer.question.points}
                      </span>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap break-words">
                      {answerText(
                        answer.question.type,
                        answer.response,
                        answer.question.choices,
                      )}
                    </p>
                    {answer.file && (
                      <a
                        className="mt-2 block font-semibold text-indigo-600"
                        href={`/api/quiz-answer-files/${answer.id}`}
                      >
                        {answer.file.originalFilename} 다운로드
                      </a>
                    )}
                    {manual && (
                      <form
                        action={gradeQuizAnswer}
                        className="mt-3 grid gap-2 sm:grid-cols-[120px_1fr_auto]"
                      >
                        <input
                          name="organizationId"
                          type="hidden"
                          value={organizationId}
                        />
                        <input
                          name="assignmentId"
                          type="hidden"
                          value={assignmentId}
                        />
                        <input name="quizId" type="hidden" value={quizId} />
                        <input
                          name="attemptId"
                          type="hidden"
                          value={attempt.id}
                        />
                        <input
                          name="answerId"
                          type="hidden"
                          value={answer.id}
                        />
                        <input
                          className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-900"
                          defaultValue={answer.score ?? ""}
                          max={answer.question.points}
                          min={0}
                          name="score"
                          placeholder="점수"
                          required
                          type="number"
                        />
                        <input
                          className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-900"
                          defaultValue={answer.feedback ?? ""}
                          name="feedback"
                          placeholder="피드백"
                        />
                        <Button type="submit">채점</Button>
                      </form>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
