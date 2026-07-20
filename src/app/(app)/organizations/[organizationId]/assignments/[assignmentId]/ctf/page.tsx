import { AssignmentItemType } from "@prisma/client";
import { ArrowLeft, Plus } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { CHALLENGE_CATEGORY_LABELS, INTERNAL_CHALLENGE_MODE_LABELS } from "@/constants/challenge";
import { requireOrganizationAccess } from "@/features/organization/guards";
import { canManageOrganization, canReviewSubmissions } from "@/features/organization/permissions";
import { formatKoreanDateTime } from "@/lib/date";
import { prisma } from "@/lib/prisma";

export default async function InternalChallengeStatusPage({
  params,
}: {
  params: Promise<{ organizationId: string; assignmentId: string }>;
}) {
  const { organizationId, assignmentId } = await params;
  const { user, membership } = await requireOrganizationAccess(organizationId);
  const canReview = canReviewSubmissions({ systemRole: user.systemRole, membership });
  if (!canReview) notFound();
  const canManage = canManageOrganization({ systemRole: user.systemRole, membership });
  const assignment = await prisma.assignment.findFirst({
    where: { id: assignmentId, organizationId, archivedAt: null },
    select: {
      title: true,
      items: {
        where: { type: AssignmentItemType.INTERNAL_CTF },
        orderBy: { position: "asc" },
        select: {
          id: true,
          internalChallenge: { select: { title: true, category: true, difficulty: true, points: true, mode: true } },
          challengeSubmissions: {
            orderBy: [{ completedAt: "desc" }, { user: { name: "asc" } }],
            select: { id: true, attemptsCount: true, completedAt: true, score: true, user: { select: { name: true, email: true } } },
          },
        },
      },
    },
  });
  if (!assignment) notFound();
  const challenges = assignment.items.filter((item) => item.internalChallenge);
  return (
    <div className="max-w-5xl">
      <Link className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500" href={`/organizations/${organizationId}/assignments/${assignmentId}`}><ArrowLeft size={17} /> 과제로 돌아가기</Link>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-semibold text-indigo-600">자체 CTF 검토</p><h1 className="mt-1 text-3xl font-bold">{assignment.title} 제출 현황</h1></div>{canManage && <Link className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-indigo-600 px-4 font-semibold text-white" href={`/organizations/${organizationId}/assignments/${assignmentId}/ctf/new`}><Plus size={18} /> 문제 추가</Link>}</div>
      <div className="mt-6 space-y-5">
        {challenges.map((item) => {
          const challenge = item.internalChallenge!;
          const completed = item.challengeSubmissions.filter((submission) => submission.completedAt).length;
          return <Card key={item.id}><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold text-slate-500">{INTERNAL_CHALLENGE_MODE_LABELS[challenge.mode]} · {CHALLENGE_CATEGORY_LABELS[challenge.category]} · {challenge.difficulty}</p><h2 className="mt-1 text-xl font-bold">{challenge.title}</h2></div><strong className="text-indigo-600">{challenge.points}점</strong></div><p className="mt-3 text-sm text-slate-500">제출 {item.challengeSubmissions.length}명 · 완료 {completed}명</p>{item.challengeSubmissions.length ? <div className="mt-4 space-y-2">{item.challengeSubmissions.map((submission) => <div className="rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-800" key={submission.id}><div className="flex flex-wrap justify-between gap-2"><span><strong>{submission.user.name}</strong> <span className="text-xs text-slate-500">{submission.user.email}</span></span><strong className={submission.completedAt ? "text-emerald-600" : "text-slate-500"}>{submission.completedAt ? "완료" : "진행 중"}</strong></div><p className="mt-1 text-xs text-slate-500">시도 {submission.attemptsCount}회 · 점수 {submission.score}점 · 완료 시각 {submission.completedAt ? formatKoreanDateTime(submission.completedAt) : "-"}</p></div>)}</div> : <p className="mt-4 rounded-xl border border-dashed p-4 text-center text-sm text-slate-500">아직 제출이 없습니다.</p>}</Card>;
        })}
        {!challenges.length && <Card className="border-dashed text-center text-sm text-slate-500">등록된 자체 CTF 문제가 없습니다.</Card>}
      </div>
    </div>
  );
}
