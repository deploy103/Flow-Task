import { AssignmentFieldType, SubmissionReviewDecision, SubmissionStatus } from "@prisma/client";
import { ArrowLeft, FileText } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { requireOrganizationAccess } from "@/features/organization/guards";
import { canReviewSubmissions } from "@/features/organization/permissions";
import { reviewSubmission } from "@/features/review/actions";
import { formatKoreanDateTime } from "@/lib/date";
import { prisma } from "@/lib/prisma";

const STATUS_LABELS: Record<SubmissionStatus, string> = {
  DRAFT: "임시 저장",
  SUBMITTED: "제출 완료",
  LATE: "지각 제출",
  REVIEWING: "검토 중",
  APPROVED: "승인",
  RESUBMIT_REQUIRED: "재제출 요청",
};

const DECISION_LABELS: Record<SubmissionReviewDecision, string> = {
  REVIEWING: "보류·검토 중",
  APPROVED: "승인",
  RESUBMIT_REQUIRED: "재제출 요청",
};

function formatFileSize(size: bigint) {
  return `${(Number(size) / (1024 * 1024)).toFixed(1)} MB`;
}

export default async function SubmissionReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ organizationId: string; assignmentId: string; submissionId: string }>;
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const [{ organizationId, assignmentId, submissionId }, query] = await Promise.all([params, searchParams]);
  const { user, membership } = await requireOrganizationAccess(organizationId);
  if (!canReviewSubmissions({ systemRole: user.systemRole, membership })) notFound();
  const submission = await prisma.submission.findFirst({
    where: { id: submissionId, assignmentId, assignment: { organizationId } },
    include: {
      user: { select: { name: true, email: true, studentNumber: true } },
      assignment: { select: { title: true, fields: { orderBy: { position: "asc" } } } },
      versions: {
        orderBy: { version: "desc" },
        include: { answers: true, files: true },
      },
      reviews: {
        orderBy: { createdAt: "desc" },
        include: { reviewer: { select: { name: true } }, version: { select: { version: true } } },
      },
    },
  });
  if (!submission) notFound();
  const latestVersion = submission.versions.find((version) => version.version === submission.latestVersion);
  if (!latestVersion) notFound();

  return (
    <div className="max-w-4xl">
      <Link className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500" href={`/organizations/${organizationId}/assignments/${assignmentId}/submissions`}><ArrowLeft size={17} /> 제출 현황으로</Link>
      <div className="mt-4 flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-semibold text-indigo-600">제출물 검토</p><h1 className="mt-1 text-3xl font-bold">{submission.user.name}</h1><p className="mt-2 text-sm text-slate-500">{submission.user.studentNumber ?? "학번 없음"} · {submission.user.email}</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-bold dark:bg-slate-800">{STATUS_LABELS[submission.status]} · {submission.latestVersion}차</span></div>
      {query.error && <p className="mt-5 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">검토 내용이 유효하지 않거나 제출 버전이 변경되었습니다.</p>}
      {query.success && <p className="mt-5 rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">검토 결과를 저장했습니다.</p>}

      <Card className="mt-5"><h2 className="text-lg font-bold">최신 제출 · {formatKoreanDateTime(latestVersion.savedAt)}</h2><div className="mt-4 space-y-4">{submission.assignment.fields.map((field) => { const answer = latestVersion.answers.find((item) => item.fieldId === field.id); const files = latestVersion.files.filter((item) => item.fieldId === field.id); return <div key={field.id} className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800"><strong className="text-sm">{field.label}</strong>{answer && (field.type === AssignmentFieldType.LINK ? <a className="mt-2 block break-all text-sm font-semibold text-indigo-600" href={answer.value} rel="noreferrer" target="_blank">{answer.value}</a> : <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{answer.value}</p>)}{files.map((file) => <a className="mt-2 flex items-center gap-2 text-sm font-semibold text-indigo-600" href={`/api/submission-files/${file.id}`} key={file.id}><FileText size={16} /> {file.originalFilename} ({formatFileSize(file.sizeBytes)})</a>)}</div>; })}</div></Card>

      <Card className="mt-5"><h2 className="text-lg font-bold">검토 결과 입력</h2>{submission.status === SubmissionStatus.DRAFT ? <p className="mt-4 text-sm text-slate-500">임시 저장 제출물은 최종 제출 후 검토할 수 있습니다.</p> : <form action={reviewSubmission} className="mt-4 space-y-4"><input name="organizationId" type="hidden" value={organizationId} /><input name="assignmentId" type="hidden" value={assignmentId} /><input name="submissionId" type="hidden" value={submissionId} /><input name="versionId" type="hidden" value={latestVersion.id} /><div><label className="mb-2 block text-sm font-semibold" htmlFor="decision">처리</label><select className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-900" id="decision" name="decision" defaultValue={SubmissionReviewDecision.REVIEWING}><option value={SubmissionReviewDecision.REVIEWING}>보류·검토 중</option><option value={SubmissionReviewDecision.APPROVED}>승인</option><option value={SubmissionReviewDecision.RESUBMIT_REQUIRED}>재제출 요청</option></select></div><div><label className="mb-2 block text-sm font-semibold" htmlFor="score">점수 (0~100, 선택)</label><Input id="score" max={100} min={0} name="score" type="number" /></div><div><label className="mb-2 block text-sm font-semibold" htmlFor="feedback">피드백</label><textarea className="min-h-32 w-full rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900" id="feedback" maxLength={10_000} name="feedback" placeholder="재제출 요청에는 피드백이 필수입니다." /></div><Button type="submit">검토 결과 저장</Button></form>}</Card>

      <Card className="mt-5"><h2 className="text-lg font-bold">검토 이력</h2>{submission.reviews.length ? <ul className="mt-4 space-y-3">{submission.reviews.map((review) => <li className="rounded-xl bg-slate-50 p-4 text-sm dark:bg-slate-800" key={review.id}><div className="flex flex-wrap justify-between gap-2"><strong>{DECISION_LABELS[review.decision]} · {review.version.version}차</strong><span className="text-slate-500">{formatKoreanDateTime(review.createdAt)}</span></div><p className="mt-1 text-slate-500">검토자 {review.reviewer.name} · 점수 {review.score ?? "-"}</p>{review.feedback && <p className="mt-3 whitespace-pre-wrap">{review.feedback}</p>}</li>)}</ul> : <p className="mt-4 text-sm text-slate-500">아직 검토 이력이 없습니다.</p>}</Card>

      <Card className="mt-5"><h2 className="text-lg font-bold">전체 제출 버전</h2><ul className="mt-4 space-y-2">{submission.versions.map((version) => <li className="flex flex-wrap justify-between gap-2 rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-800" key={version.id}><strong>{version.version}차 · {STATUS_LABELS[version.status]}</strong><span className="text-slate-500">{formatKoreanDateTime(version.savedAt)}</span></li>)}</ul></Card>
    </div>
  );
}
