import { SubmissionStatus } from "@prisma/client";
import { ArrowLeft, Download, Eye } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { requireOrganizationAccess } from "@/features/organization/guards";
import { canReviewSubmissions } from "@/features/organization/permissions";
import { getAssignmentSubmissionRoster } from "@/features/review/queries";
import { formatKoreanDateTime } from "@/lib/date";

const STATUS_LABELS: Record<SubmissionStatus, string> = {
  DRAFT: "임시 저장",
  SUBMITTED: "제출 완료",
  LATE: "지각 제출",
  REVIEWING: "검토 중",
  APPROVED: "승인",
  RESUBMIT_REQUIRED: "재제출 요청",
};

const REVIEW_PENDING_STATUSES = new Set<SubmissionStatus>([
  SubmissionStatus.SUBMITTED,
  SubmissionStatus.LATE,
  SubmissionStatus.REVIEWING,
]);

export default async function SubmissionStatusPage({
  params,
}: {
  params: Promise<{ organizationId: string; assignmentId: string }>;
}) {
  const { organizationId, assignmentId } = await params;
  const { user, membership } = await requireOrganizationAccess(organizationId);
  if (!canReviewSubmissions({ systemRole: user.systemRole, membership })) notFound();
  const data = await getAssignmentSubmissionRoster(organizationId, assignmentId);
  if (!data) notFound();
  const submittedCount = data.rows.filter(
    ({ submission }) => submission && submission.status !== SubmissionStatus.DRAFT,
  ).length;
  const lateCount = data.rows.filter(({ isLate }) => isLate).length;
  const reviewCount = data.rows.filter(({ submission }) =>
    submission ? REVIEW_PENDING_STATUSES.has(submission.status) : false,
  ).length;

  return (
    <div>
      <Link className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500" href={`/organizations/${organizationId}/assignments/${assignmentId}`}><ArrowLeft size={17} /> 과제로 돌아가기</Link>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-sm font-semibold text-indigo-600">관리자 검토</p><h1 className="mt-1 text-3xl font-bold">{data.assignment.title} 제출 현황</h1></div>
        <a className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 px-4 font-semibold dark:border-slate-700" href={`/api/organizations/${organizationId}/assignments/${assignmentId}/submissions.csv`}><Download size={18} /> CSV 다운로드</a>
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-4">
        <Card><p className="text-sm text-slate-500">전체 대상</p><strong className="mt-2 block text-2xl">{data.rows.length}</strong></Card>
        <Card><p className="text-sm text-slate-500">최종 제출</p><strong className="mt-2 block text-2xl text-emerald-600">{submittedCount}</strong></Card>
        <Card><p className="text-sm text-slate-500">미제출·임시저장</p><strong className="mt-2 block text-2xl text-red-500">{data.rows.length - submittedCount}</strong></Card>
        <Card><p className="text-sm text-slate-500">검토 대기 / 지각</p><strong className="mt-2 block text-2xl">{reviewCount} / {lateCount}</strong></Card>
      </div>
      <Card className="mt-5 overflow-x-auto p-0">
        <table className="w-full min-w-[760px] text-left text-sm"><thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950"><tr><th className="p-4">이름</th><th className="p-4">학번</th><th className="p-4">상태</th><th className="p-4">제출 시각</th><th className="p-4">점수</th><th className="p-4">검토</th></tr></thead><tbody>{data.rows.map(({ member, submission, isLate }) => <tr className="border-b border-slate-100 last:border-0 dark:border-slate-800" key={member.userId}><td className="p-4"><strong>{member.user.name}</strong><span className="block text-xs text-slate-500">{member.user.email}</span></td><td className="p-4">{member.user.studentNumber ?? "-"}</td><td className="p-4">{submission ? `${STATUS_LABELS[submission.status]}${isLate ? " · 지각" : ""}` : "미제출"}</td><td className="p-4">{submission?.submittedAt ? formatKoreanDateTime(submission.submittedAt) : "-"}</td><td className="p-4">{submission?.reviews[0]?.score ?? "-"}</td><td className="p-4">{submission ? <Link className="inline-flex items-center gap-1 font-semibold text-indigo-600" href={`/organizations/${organizationId}/assignments/${assignmentId}/submissions/${submission.id}`}><Eye size={16} /> 보기</Link> : <span className="text-slate-400">-</span>}</td></tr>)}</tbody></table>
      </Card>
    </div>
  );
}
