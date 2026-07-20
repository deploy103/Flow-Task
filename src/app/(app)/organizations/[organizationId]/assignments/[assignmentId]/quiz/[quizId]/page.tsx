import { ArrowLeft, BarChart3, Settings } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { canViewAssignment, isAssignmentPublished } from "@/features/assignment/visibility";
import { requireOrganizationAccess } from "@/features/organization/guards";
import { canManageOrganization, canReviewSubmissions } from "@/features/organization/permissions";
import { startQuizAttempt } from "@/features/quiz/attempt-actions";
import { getQuizAttemptState } from "@/features/quiz/attempt-policy";
import { shouldReleaseQuizResult } from "@/features/quiz/grading";
import { canSubmitAssignment } from "@/features/submission/access";
import { formatKoreanDateTime } from "@/lib/date";
import { prisma } from "@/lib/prisma";

const ERRORS: Record<string, string> = { not_ready: "아직 문항 구성이 끝나지 않았습니다.", not_target: "응시 대상이 아닙니다.", not_open: "아직 응시 기간이 아닙니다.", closed: "응시 기간이 종료되었습니다.", attempt_limit: "응시 횟수를 모두 사용했습니다.", start_failed: "응시를 시작하지 못했습니다." };

export default async function QuizPage({ params, searchParams }: { params: Promise<{ organizationId: string; assignmentId: string; quizId: string }>; searchParams: Promise<{ error?: string; success?: string }> }) {
  const [{ organizationId, assignmentId, quizId }, query] = await Promise.all([params, searchParams]);
  const { user, membership } = await requireOrganizationAccess(organizationId);
  const canManage = canManageOrganization({ systemRole: user.systemRole, membership });
  const canReview = canReviewSubmissions({ systemRole: user.systemRole, membership });
  const quiz = await prisma.quiz.findFirst({
    where: { assignmentItemId: quizId, assignmentItem: { assignmentId, assignment: { organizationId, archivedAt: null } } },
    select: {
      title: true,
      description: true,
      timeLimitMinutes: true,
      attemptLimit: true,
      passingScore: true,
      resultRelease: true,
      _count: { select: { questions: true } },
      assignmentItem: { select: { assignment: { select: { audience: true, opensAt: true, deadline: true, allowLate: true, targets: { select: { userId: true } } } } } },
      attempts: { where: { userId: user.id }, orderBy: { attemptNumber: "desc" }, select: { id: true, attemptNumber: true, status: true, startedAt: true, submittedAt: true, score: true, maxScore: true, passed: true, expiresAt: true } },
    },
  });
  if (!quiz) notFound();
  const assignment = quiz.assignmentItem.assignment;
  const targetIds = assignment.targets.map(({ userId }) => userId);
  if (!canViewAssignment({ audience: assignment.audience, targetUserIds: targetIds, userId: user.id, systemRole: user.systemRole, canManage: canManage || canReview }) || (!(canManage || canReview) && !isAssignmentPublished(assignment.opensAt))) notFound();
  const canSubmit = canSubmitAssignment({ audience: assignment.audience, targetUserIds: targetIds, userId: user.id, membershipStatus: membership?.status });
  const access = getQuizAttemptState({ canSubmit, opensAt: assignment.opensAt, deadline: assignment.deadline, allowLate: assignment.allowLate, attemptsUsed: quiz.attempts.length, attemptLimit: quiz.attemptLimit });
  const active = quiz.attempts.find((attempt) => attempt.status === "IN_PROGRESS" && (!attempt.expiresAt || attempt.expiresAt > new Date()));
  return <div className="max-w-4xl"><Link className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500" href={`/organizations/${organizationId}/assignments/${assignmentId}`}><ArrowLeft size={17} /> 과제로 돌아가기</Link><div className="mt-4 flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-3xl font-bold">{quiz.title}</h1><p className="mt-2 text-slate-500">{quiz.description}</p></div><div className="flex gap-2">{canManage && <Link className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 px-4 font-semibold" href={`${attemptPath(organizationId, assignmentId, quizId)}/manage`}><Settings size={17} /> 문항 관리</Link>}{canReview && <Link className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-indigo-600 px-4 font-semibold text-white" href={`${attemptPath(organizationId, assignmentId, quizId)}/results`}><BarChart3 size={17} /> 결과</Link>}</div></div>{query.error && ERRORS[query.error] && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{ERRORS[query.error]}</p>}{query.success === "submitted" && <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">퀴즈를 제출했습니다.</p>}<Card className="mt-6"><div className="grid gap-3 sm:grid-cols-4"><div><p className="text-xs text-slate-500">문항</p><strong>{quiz._count.questions}개</strong></div><div><p className="text-xs text-slate-500">제한 시간</p><strong>{quiz.timeLimitMinutes ? `${quiz.timeLimitMinutes}분` : "없음"}</strong></div><div><p className="text-xs text-slate-500">응시 횟수</p><strong>{quiz.attempts.length}/{quiz.attemptLimit}</strong></div><div><p className="text-xs text-slate-500">마감</p><strong>{formatKoreanDateTime(assignment.deadline)}</strong></div></div>{active ? <Link className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-indigo-600 px-4 font-semibold text-white" href={attemptPath(organizationId, assignmentId, quizId, active.id)}>응시 계속하기</Link> : access === "ALLOWED" && quiz._count.questions > 0 ? <form action={startQuizAttempt} className="mt-5"><input name="organizationId" type="hidden" value={organizationId} /><input name="assignmentId" type="hidden" value={assignmentId} /><input name="quizId" type="hidden" value={quizId} /><Button type="submit">새 응시 시작</Button></form> : <p className="mt-5 text-sm font-semibold text-slate-500">{access === "ATTEMPT_LIMIT" ? "응시 횟수를 모두 사용했습니다." : "현재 응시를 시작할 수 없습니다."}</p>}</Card><div className="mt-5 space-y-3">{quiz.attempts.map((attempt) => { const release = shouldReleaseQuizResult({ policy: quiz.resultRelease, deadline: assignment.deadline, status: attempt.status }); return <Card key={attempt.id}><div className="flex flex-wrap justify-between gap-2"><strong>{attempt.attemptNumber}회차 · {attempt.status}</strong><span className="text-xs text-slate-500">{formatKoreanDateTime(attempt.startedAt)}</span></div>{release && attempt.score !== null ? <p className="mt-2 font-semibold text-indigo-600">{attempt.score}/{attempt.maxScore}점 {attempt.passed === null ? "" : attempt.passed ? "· 합격" : "· 불합격"}</p> : attempt.status !== "IN_PROGRESS" ? <p className="mt-2 text-sm text-slate-500">결과 공개 정책에 따라 아직 점수를 표시하지 않습니다.</p> : null}</Card>; })}</div></div>;
}

function attemptPath(organizationId: string, assignmentId: string, quizId: string, attemptId?: string) {
  return `/organizations/${organizationId}/assignments/${assignmentId}/quiz/${quizId}${attemptId ? `/attempts/${attemptId}` : ""}`;
}
