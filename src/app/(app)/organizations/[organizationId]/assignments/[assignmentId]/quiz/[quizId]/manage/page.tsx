import { ArrowLeft, Library } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { QUIZ_QUESTION_TYPE_LABELS } from "@/constants/quiz";
import { reuseQuizQuestion } from "@/features/quiz/admin-actions";
import { QuizQuestionBuilderForm } from "@/features/quiz/components/question-builder-form";
import { requireOrganizationAccess } from "@/features/organization/guards";
import { canManageOrganization } from "@/features/organization/permissions";
import { prisma } from "@/lib/prisma";

const ERROR_MESSAGES: Record<string, string> = {
  invalid_question: "문제와 정답 설정을 확인해 주세요.",
  create_failed: "문항을 만들지 못했습니다. 잠시 후 다시 시도해 주세요.",
  reuse_failed: "문제은행 문항을 추가하지 못했습니다.",
};

export default async function ManageQuizPage({
  params,
  searchParams,
}: {
  params: Promise<{ organizationId: string; assignmentId: string; quizId: string }>;
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const [{ organizationId, assignmentId, quizId }, query] = await Promise.all([
    params,
    searchParams,
  ]);
  const { user, membership } = await requireOrganizationAccess(organizationId, true);
  if (!canManageOrganization({ systemRole: user.systemRole, membership })) notFound();
  const quiz = await prisma.quiz.findFirst({
    where: {
      assignmentItemId: quizId,
      assignmentItem: { assignmentId, assignment: { organizationId, archivedAt: null } },
    },
    select: {
      title: true,
      questions: {
        orderBy: { position: "asc" },
        select: {
          question: {
            select: {
              id: true,
              type: true,
              prompt: true,
              points: true,
              difficulty: true,
              choices: {
                orderBy: { position: "asc" },
                select: { id: true, content: true, isCorrect: true },
              },
            },
          },
        },
      },
    },
  });
  if (!quiz) notFound();
  const placedIds = quiz.questions.map(({ question }) => question.id);
  const bank = await prisma.quizQuestion.findMany({
    where: { organizationId, id: { notIn: placedIds } },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      type: true,
      prompt: true,
      points: true,
      difficulty: true,
      tags: true,
    },
  });
  const errorMessage = query.error
    ? ERROR_MESSAGES[query.error] ?? "문항 작업에 실패했습니다. 입력을 확인해 주세요."
    : null;

  return (
    <div className="max-w-5xl">
      <Link
        className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500"
        href={`/organizations/${organizationId}/assignments/${assignmentId}/quiz/${quizId}`}
      >
        <ArrowLeft size={17} /> 퀴즈로 돌아가기
      </Link>
      <h1 className="mt-4 text-3xl font-bold">{quiz.title} 문항 구성</h1>
      <p className="mt-2 text-sm text-slate-500">문제 유형을 고르고 학생에게 보일 내용과 정답을 순서대로 입력하세요.</p>
      {errorMessage && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700 dark:bg-red-950/50 dark:text-red-200" role="alert">{errorMessage}</p>}
      {query.success && <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-200">문항 구성을 저장했습니다.</p>}

      <div className="mt-6 grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-5">
          <Card>
            <h2 className="text-lg font-bold">새 문항 만들기</h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">Google Forms처럼 유형에 필요한 항목만 표시됩니다. 만든 문항은 문제은행에도 자동 저장됩니다.</p>
            <QuizQuestionBuilderForm
              assignmentId={assignmentId}
              organizationId={organizationId}
              quizId={quizId}
            />
          </Card>

          <Card>
            <h2 className="font-bold">현재 문항 {quiz.questions.length}개</h2>
            <div className="mt-3 space-y-3">
              {quiz.questions.map(({ question }, index) => (
                <div className="rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-800" key={question.id}>
                  <strong>{index + 1}. {question.prompt}</strong>
                  <p className="mt-1 text-xs text-slate-500">{QUIZ_QUESTION_TYPE_LABELS[question.type]} · {question.difficulty} · {question.points}점</p>
                  {question.choices.length > 0 && (
                    <ul className="mt-2 list-inside list-disc text-xs">
                      {question.choices.map((choice) => <li className={choice.isCorrect ? "font-semibold text-emerald-600" : ""} key={choice.id}>{choice.content}</li>)}
                    </ul>
                  )}
                </div>
              ))}
              {!quiz.questions.length && <p className="text-sm text-slate-500">아직 문항이 없습니다. 위 작성기에서 첫 문항을 만들어 보세요.</p>}
            </div>
          </Card>
        </div>

        <Card className="self-start">
          <h2 className="flex items-center gap-2 font-bold"><Library size={18} /> 문제은행</h2>
          <p className="mt-1 text-xs text-slate-500">같은 조직에서 만든 최근 문항을 재사용합니다.</p>
          <div className="mt-4 space-y-3">
            {bank.map((question) => (
              <form action={reuseQuizQuestion} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700" key={question.id}>
                <input name="organizationId" type="hidden" value={organizationId} />
                <input name="assignmentId" type="hidden" value={assignmentId} />
                <input name="quizId" type="hidden" value={quizId} />
                <input name="questionId" type="hidden" value={question.id} />
                <strong className="text-sm">{question.prompt}</strong>
                <p className="mt-1 text-xs text-slate-500">{QUIZ_QUESTION_TYPE_LABELS[question.type]} · {question.points}점 · {question.tags.join(", ")}</p>
                <Button className="mt-2" type="submit">이 퀴즈에 추가</Button>
              </form>
            ))}
            {!bank.length && <p className="text-sm text-slate-500">재사용할 문항이 없습니다.</p>}
          </div>
        </Card>
      </div>
    </div>
  );
}
