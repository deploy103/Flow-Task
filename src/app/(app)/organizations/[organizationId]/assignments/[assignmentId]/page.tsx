import { AssignmentAudience } from "@prisma/client";
import { CalendarClock, Users } from "lucide-react";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { getAssignmentTimingStatus, getDeadlineLabel } from "@/features/assignment/timing";
import { canViewAssignment, isAssignmentPublished } from "@/features/assignment/visibility";
import { requireOrganizationAccess } from "@/features/organization/guards";
import { canManageOrganization } from "@/features/organization/permissions";
import { formatKoreanDateTime } from "@/lib/date";
import { prisma } from "@/lib/prisma";

const STATUS_LABELS = {
  UPCOMING: "공개 예정",
  OPEN: "진행 중",
  CLOSED: "마감 종료",
  LATE_OPEN: "지각 제출 가능",
};

export default async function AssignmentDetailPage({ params }: { params: Promise<{ organizationId: string; assignmentId: string }> }) {
  const { organizationId, assignmentId } = await params;
  const { user, membership } = await requireOrganizationAccess(organizationId);
  const canManage = canManageOrganization({ systemRole: user.systemRole, membership });
  const assignment = await prisma.assignment.findFirst({
    where: { id: assignmentId, organizationId, archivedAt: null },
    include: {
      createdBy: { select: { name: true } },
      targets: { include: { user: { select: { id: true, name: true, email: true } } } },
      fields: { orderBy: { position: "asc" } },
    },
  });
  if (!assignment) notFound();
  const visible = canViewAssignment({ audience: assignment.audience, targetUserIds: assignment.targets.map(({ userId }) => userId), userId: user.id, systemRole: user.systemRole, canManage });
  if (!visible || (!canManage && !isAssignmentPublished(assignment.opensAt))) notFound();
  const timingStatus = getAssignmentTimingStatus(assignment);

  return (
    <div className="max-w-4xl">
      <div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-200">{STATUS_LABELS[timingStatus]}</span><strong className="text-sm text-slate-500">{getDeadlineLabel(assignment.deadline)}</strong></div>
      <h1 className="mt-3 text-3xl font-bold">{assignment.title}</h1><p className="mt-2 text-sm text-slate-500">담당자 {assignment.createdBy.name}</p>
      <Card className="mt-6"><div className="grid gap-4 sm:grid-cols-2"><div className="flex items-start gap-3"><CalendarClock className="mt-0.5 text-indigo-600" size={20} /><div><p className="text-sm text-slate-500">공개일</p><p className="mt-1 font-semibold">{formatKoreanDateTime(assignment.opensAt)}</p></div></div><div className="flex items-start gap-3"><CalendarClock className="mt-0.5 text-red-500" size={20} /><div><p className="text-sm text-slate-500">마감일</p><p className="mt-1 font-semibold">{formatKoreanDateTime(assignment.deadline)}</p></div></div></div><div className="mt-4 border-t border-slate-200 pt-4 text-sm text-slate-500 dark:border-slate-800">{assignment.allowLate ? "마감 후 지각 제출이 허용됩니다." : "마감 후에는 제출할 수 없습니다."}</div></Card>
      <Card className="mt-5"><h2 className="text-lg font-bold">과제 설명</h2><div className="mt-4 whitespace-pre-wrap leading-7">{assignment.description}</div></Card>
      <Card className="mt-5"><h2 className="text-lg font-bold">제출할 내용</h2><ul className="mt-4 space-y-2">{assignment.fields.map((field) => <li key={field.id} className="flex items-center justify-between rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-800"><span className="font-semibold">{field.label}</span><span className="text-slate-500">필수</span></li>)}</ul></Card>
      {canManage && assignment.audience === AssignmentAudience.SELECTED_MEMBERS && <Card className="mt-5"><h2 className="flex items-center gap-2 font-bold"><Users size={19} /> 과제 대상 {assignment.targets.length}명</h2><ul className="mt-4 grid gap-2 sm:grid-cols-2">{assignment.targets.map(({ user: targetUser }) => <li key={targetUser.id} className="rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-800"><strong className="block">{targetUser.name}</strong><span className="text-slate-500">{targetUser.email}</span></li>)}</ul></Card>}
      <div className="mt-5 rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-slate-700">텍스트·파일·링크 제출은 4단계 제출 시스템에서 연결됩니다.</div>
    </div>
  );
}
