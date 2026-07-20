import { AssignmentAudience, AssignmentFieldType, SubmissionReviewDecision, SubmissionStatus } from "@prisma/client";
import { CalendarClock, ClipboardCheck, FileText, Link as LinkIcon, Upload, Users } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  BYTES_PER_MEBIBYTE,
  MAX_SUBMISSION_FILE_COUNT,
  MAX_SUBMISSION_FILE_SIZE_BYTES,
  MAX_SUBMISSION_TOTAL_FILE_SIZE_BYTES,
  SUBMISSION_FILE_MIME_TYPES,
} from "@/constants/assignment";
import { getAssignmentTimingStatus, getDeadlineLabel } from "@/features/assignment/timing";
import { canViewAssignment, isAssignmentPublished } from "@/features/assignment/visibility";
import { AssignmentChallenges } from "@/features/challenge/components/assignment-challenges";
import { requireOrganizationAccess } from "@/features/organization/guards";
import { canManageOrganization, canReviewSubmissions } from "@/features/organization/permissions";
import { canSubmitAssignment } from "@/features/submission/access";
import { saveSubmission } from "@/features/submission/actions";
import { SubmissionActionButtons } from "@/features/submission/components/submission-action-buttons";
import { SubmissionFileInput } from "@/features/submission/components/submission-file-input";
import { SubmissionUploadProvider } from "@/features/submission/components/submission-upload-context";
import { formatKoreanDateTime } from "@/lib/date";
import { prisma } from "@/lib/prisma";

const TIMING_STATUS_LABELS = {
  UPCOMING: "공개 예정",
  OPEN: "진행 중",
  CLOSED: "마감 종료",
  LATE_OPEN: "지각 제출 가능",
};

const SUBMISSION_STATUS_LABELS: Record<SubmissionStatus, string> = {
  DRAFT: "임시 저장",
  SUBMITTED: "제출 완료",
  LATE: "지각 제출",
  REVIEWING: "검토 중",
  APPROVED: "승인",
  RESUBMIT_REQUIRED: "재제출 요청",
};

const REVIEW_DECISION_LABELS: Record<SubmissionReviewDecision, string> = {
  REVIEWING: "검토 중",
  APPROVED: "승인",
  RESUBMIT_REQUIRED: "재제출 요청",
};

const ERROR_MESSAGES: Record<string, string> = {
  invalid_input: "입력한 제출 내용을 다시 확인해 주세요.",
  invalid_file: "허용된 형식과 크기에 맞는 파일을 선택해 주세요.",
  invalid_file_count: `파일은 최대 ${MAX_SUBMISSION_FILE_COUNT}개, 전체 ${MAX_SUBMISSION_TOTAL_FILE_SIZE_BYTES / BYTES_PER_MEBIBYTE}MB까지 제출할 수 있습니다.`,
  file_required: "필수 파일을 첨부해 주세요.",
  upload_failed: "파일 업로드에 실패했습니다. 잠시 후 다시 시도해 주세요.",
  save_failed: "제출 저장에 실패했습니다. 중복 제출 여부를 확인하고 다시 시도해 주세요.",
  not_open: "아직 제출 기간이 시작되지 않았습니다.",
  closed: "마감되어 더 이상 제출할 수 없습니다.",
  not_target: "이 과제의 제출 대상이 아닙니다.",
};

const SUCCESS_MESSAGES: Record<string, string> = {
  draft_saved: "임시 저장했습니다. 이전 버전도 그대로 보관됩니다.",
  submitted: "최종 제출했습니다. 수정하면 새 버전으로 저장됩니다.",
};

function formatFileSize(sizeBytes: bigint) {
  const megabytes = Number(sizeBytes) / (1024 * 1024);
  return megabytes >= 1 ? `${megabytes.toFixed(1)} MB` : `${Math.ceil(Number(sizeBytes) / 1024)} KB`;
}

export default async function AssignmentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ organizationId: string; assignmentId: string }>;
  searchParams: Promise<{
    error?: string;
    success?: string;
    challenge_error?: string;
    challenge_success?: string;
    challenge_item?: string;
  }>;
}) {
  const [{ organizationId, assignmentId }, query] = await Promise.all([params, searchParams]);
  const { user, membership } = await requireOrganizationAccess(organizationId);
  const canManage = canManageOrganization({ systemRole: user.systemRole, membership });
  const canReview = canReviewSubmissions({ systemRole: user.systemRole, membership });
  const assignment = await prisma.assignment.findFirst({
    where: { id: assignmentId, organizationId, archivedAt: null },
    include: {
      createdBy: { select: { name: true } },
      targets: { include: { user: { select: { id: true, name: true, email: true } } } },
      fields: { orderBy: { position: "asc" } },
      submissions: {
        where: { userId: user.id },
        include: {
          reviews: {
            orderBy: { createdAt: "desc" },
            include: {
              reviewer: { select: { name: true } },
              version: { select: { version: true } },
            },
          },
          versions: {
            orderBy: { version: "desc" },
            include: { answers: true, files: true },
          },
        },
      },
    },
  });
  if (!assignment) notFound();

  const targetUserIds = assignment.targets.map(({ userId }) => userId);
  const visible = canViewAssignment({
    audience: assignment.audience,
    targetUserIds,
    userId: user.id,
    systemRole: user.systemRole,
    canManage: canManage || canReview,
  });
  if (!visible || (!(canManage || canReview) && !isAssignmentPublished(assignment.opensAt))) notFound();

  const timingStatus = getAssignmentTimingStatus(assignment);
  const canSubmit = canSubmitAssignment({
    audience: assignment.audience,
    targetUserIds,
    userId: user.id,
    membershipStatus: membership?.status,
  });
  const submission = assignment.submissions[0];
  const currentVersion = submission?.versions[0];
  const latestReview = submission?.reviews.find(
    (review) => review.version.version === submission.latestVersion,
  );
  const answerByFieldId = new Map(currentVersion?.answers.map((answer) => [answer.fieldId, answer.value]));
  const currentFilesByFieldId = new Map(
    assignment.fields.map((field) => [
      field.id,
      currentVersion?.files.filter((file) => file.fieldId === field.id) ?? [],
    ]),
  );
  const submissionOpen = timingStatus === "OPEN" || timingStatus === "LATE_OPEN";
  const fileAccept = Object.keys(SUBMISSION_FILE_MIME_TYPES)
    .map((extension) => `.${extension}`)
    .join(",");

  return (
    <div className="max-w-4xl">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-200">
          {TIMING_STATUS_LABELS[timingStatus]}
        </span>
        <strong className="text-sm text-slate-500">{getDeadlineLabel(assignment.deadline)}</strong>
      </div>
      <h1 className="mt-3 text-3xl font-bold">{assignment.title}</h1>
      <p className="mt-2 text-sm text-slate-500">담당자 {assignment.createdBy.name}</p>

      {query.error && ERROR_MESSAGES[query.error] && (
        <p className="mt-5 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700 dark:bg-red-950/50 dark:text-red-200">
          {ERROR_MESSAGES[query.error]}
        </p>
      )}
      {query.success && SUCCESS_MESSAGES[query.success] && (
        <p className="mt-5 rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-200">
          {SUCCESS_MESSAGES[query.success]}
        </p>
      )}

      <Card className="mt-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex items-start gap-3">
            <CalendarClock className="mt-0.5 text-indigo-600" size={20} />
            <div><p className="text-sm text-slate-500">공개일</p><p className="mt-1 font-semibold">{formatKoreanDateTime(assignment.opensAt)}</p></div>
          </div>
          <div className="flex items-start gap-3">
            <CalendarClock className="mt-0.5 text-red-500" size={20} />
            <div><p className="text-sm text-slate-500">마감일</p><p className="mt-1 font-semibold">{formatKoreanDateTime(assignment.deadline)}</p></div>
          </div>
        </div>
        <div className="mt-4 border-t border-slate-200 pt-4 text-sm text-slate-500 dark:border-slate-800">
          {assignment.allowLate ? "마감 후 지각 제출이 허용됩니다." : "마감 후에는 제출할 수 없습니다."}
        </div>
      </Card>

      <Card className="mt-5">
        <h2 className="text-lg font-bold">과제 설명</h2>
        <div className="mt-4 whitespace-pre-wrap leading-7">{assignment.description}</div>
      </Card>

      <AssignmentChallenges
        allowLate={assignment.allowLate}
        assignmentId={assignmentId}
        canManage={canManage}
        canReview={canReview}
        canSubmit={canSubmit}
        deadline={assignment.deadline}
        feedback={{
          error: query.challenge_error,
          success: query.challenge_success,
          itemId: query.challenge_item,
        }}
        opensAt={assignment.opensAt}
        organizationId={organizationId}
        userId={user.id}
      />

      {canReview && (
        <Link className="mt-5 flex items-center justify-between rounded-2xl border border-indigo-200 bg-indigo-50 p-5 font-bold text-indigo-700 transition hover:border-indigo-400 dark:border-indigo-900 dark:bg-indigo-950 dark:text-indigo-200" href={`/organizations/${organizationId}/assignments/${assignmentId}/submissions`}>
          <span className="flex items-center gap-2"><ClipboardCheck size={20} /> 제출 현황 및 검토</span><span>열기 →</span>
        </Link>
      )}

      {canSubmit && assignment.fields.length > 0 && (
        <Card className="mt-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold">과제 제출</h2>
              <p className="mt-1 text-sm text-slate-500">임시 저장과 수정도 새 버전으로 안전하게 보관됩니다.</p>
            </div>
            {submission && (
              <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold dark:bg-slate-800">
                {SUBMISSION_STATUS_LABELS[submission.status]} · {submission.latestVersion}차
              </span>
            )}
          </div>

          <SubmissionUploadProvider>
            <form action={saveSubmission} className="mt-5 space-y-5">
              <input type="hidden" name="organizationId" value={organizationId} />
              <input type="hidden" name="assignmentId" value={assignmentId} />
              {assignment.fields.map((field) => (
                <div key={field.id}>
                <label className="mb-2 block text-sm font-semibold" htmlFor={`field-${field.id}`}>
                  {field.label} {field.required && <span className="text-red-500">*</span>}
                </label>
                {field.type === AssignmentFieldType.TEXT && (
                  <textarea
                    className="min-h-40 w-full rounded-xl border border-slate-200 bg-white p-3 text-slate-900 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50"
                    defaultValue={answerByFieldId.get(field.id) ?? ""}
                    disabled={!submissionOpen}
                    id={`field-${field.id}`}
                    maxLength={50_000}
                    name={`field-${field.id}`}
                    placeholder="제출 내용을 입력하세요."
                  />
                )}
                {field.type === AssignmentFieldType.LINK && (
                  <div className="relative">
                    <LinkIcon className="absolute left-3 top-3 text-slate-400" size={18} />
                    <Input
                      className="pl-10"
                      defaultValue={answerByFieldId.get(field.id) ?? ""}
                      disabled={!submissionOpen}
                      id={`field-${field.id}`}
                      maxLength={2_048}
                      name={`field-${field.id}`}
                      placeholder="https://"
                      type="url"
                    />
                  </div>
                )}
                {field.type === AssignmentFieldType.FILE && (
                  <div className="rounded-xl border border-dashed border-slate-300 p-4 dark:border-slate-700">
                    <div className="flex items-center gap-2 text-sm font-semibold"><Upload size={18} /> 파일 선택</div>
                    <SubmissionFileInput
                      accept={fileAccept}
                      assignmentId={assignmentId}
                      disabled={!submissionOpen}
                      fieldId={field.id}
                      organizationId={organizationId}
                    />
                    <p className="mt-2 text-xs text-slate-500">
                      PDF, 한글, Office, ZIP, PNG, JPG · 최대 {MAX_SUBMISSION_FILE_COUNT}개 · 파일당 {MAX_SUBMISSION_FILE_SIZE_BYTES / BYTES_PER_MEBIBYTE}MB · 전체 {MAX_SUBMISSION_TOTAL_FILE_SIZE_BYTES / BYTES_PER_MEBIBYTE}MB
                    </p>
                    {(currentFilesByFieldId.get(field.id)?.length ?? 0) > 0 && (
                      <div className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                        <p className="font-semibold">현재 파일</p>
                        <ul className="mt-1 list-inside list-disc">
                          {currentFilesByFieldId.get(field.id)?.map((file) => (
                            <li key={file.id}>{file.originalFilename}</li>
                          ))}
                        </ul>
                        <p className="mt-1 text-xs text-slate-500">새 파일을 선택하면 현재 파일 전체가 교체됩니다.</p>
                      </div>
                    )}
                  </div>
                )}
                </div>
              ))}
              <SubmissionActionButtons disabled={!submissionOpen} />
            </form>
          </SubmissionUploadProvider>
        </Card>
      )}

      {submission?.versions.length ? (
        <>
        {latestReview && (
          <Card className="mt-5">
            <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-bold">담당자 피드백</h2><strong className="text-indigo-600">{REVIEW_DECISION_LABELS[latestReview.decision]}</strong></div>
            <p className="mt-2 text-sm text-slate-500">{latestReview.reviewer.name} · {formatKoreanDateTime(latestReview.createdAt)} · 점수 {latestReview.score ?? "-"}</p>
            {latestReview.feedback && <p className="mt-4 whitespace-pre-wrap leading-7">{latestReview.feedback}</p>}
          </Card>
        )}
        <Card className="mt-5">
          <h2 className="flex items-center gap-2 text-lg font-bold"><FileText size={20} /> 제출 내역</h2>
          <div className="mt-4 space-y-3">
            {submission.versions.map((version) => (
              <div key={version.id} className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <strong>{version.version}차 · {SUBMISSION_STATUS_LABELS[version.status]}</strong>
                  <span className="text-xs text-slate-500">{formatKoreanDateTime(version.savedAt)}</span>
                </div>
                {version.answers.map((answer) => {
                  const field = assignment.fields.find((candidate) => candidate.id === answer.fieldId);
                  if (!field) return null;
                  return (
                    <div className="mt-3 text-sm" key={answer.id}>
                      <span className="font-semibold text-slate-500">{field.label}</span>
                      {field.type === AssignmentFieldType.LINK ? (
                        <a className="mt-1 block break-all font-semibold text-indigo-600 hover:underline dark:text-indigo-300" href={answer.value} rel="noreferrer" target="_blank">
                          {answer.value}
                        </a>
                      ) : (
                        <p className="mt-1 whitespace-pre-wrap break-words">{answer.value}</p>
                      )}
                    </div>
                  );
                })}
                {version.files.map((file) => (
                  <a className="mt-3 block text-sm font-semibold text-indigo-600 hover:underline dark:text-indigo-300" href={`/api/submission-files/${file.id}`} key={file.id}>
                    {file.originalFilename} ({formatFileSize(file.sizeBytes)})
                  </a>
                ))}
              </div>
            ))}
          </div>
        </Card>
        </>
      ) : null}

      {canManage && assignment.audience === AssignmentAudience.SELECTED_MEMBERS && (
        <Card className="mt-5">
          <h2 className="flex items-center gap-2 font-bold"><Users size={19} /> 과제 대상 {assignment.targets.length}명</h2>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {assignment.targets.map(({ user: targetUser }) => (
              <li key={targetUser.id} className="rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-800">
                <strong className="block">{targetUser.name}</strong><span className="text-slate-500">{targetUser.email}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
