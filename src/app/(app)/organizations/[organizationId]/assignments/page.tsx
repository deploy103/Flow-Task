import { AssignmentAudience } from "@prisma/client";
import { ClipboardList, Plus } from "lucide-react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { getAssignmentTimingStatus, getDeadlineLabel } from "@/features/assignment/timing";
import { requireOrganizationAccess } from "@/features/organization/guards";
import { canManageOrganization, canReviewSubmissions } from "@/features/organization/permissions";
import { formatKoreanDateTime } from "@/lib/date";
import { prisma } from "@/lib/prisma";

const STATUS_LABELS = {
  UPCOMING: "공개 예정",
  OPEN: "진행 중",
  CLOSED: "마감 종료",
  LATE_OPEN: "지각 제출 가능",
};

export default async function AssignmentsPage({ params, searchParams }: { params: Promise<{ organizationId: string }>; searchParams: Promise<{ error?: string; success?: string }> }) {
  const [{ organizationId }, query] = await Promise.all([params, searchParams]);
  const { user, membership } = await requireOrganizationAccess(organizationId);
  const canManage = canManageOrganization({ systemRole: user.systemRole, membership });
  const canViewAllAssignments =
    canManage || canReviewSubmissions({ systemRole: user.systemRole, membership });
  const assignments = await prisma.assignment.findMany({
    where: {
      organizationId,
      archivedAt: null,
      ...(canViewAllAssignments
        ? {}
        : {
            opensAt: { lte: new Date() },
            OR: [
              { audience: AssignmentAudience.ALL_MEMBERS },
              { targets: { some: { userId: user.id } } },
            ],
          }),
    },
    include: { createdBy: { select: { name: true } } },
    orderBy: [{ deadline: "asc" }, { createdAt: "desc" }],
  });

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-sm font-semibold text-indigo-600">해야 할 일</p><h1 className="mt-1 text-3xl font-bold">과제</h1><p className="mt-2 text-slate-500">공개된 과제와 마감 일정을 확인하세요.</p></div>
        {canManage && <Link href={`/organizations/${organizationId}/assignments/new`} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-indigo-600 px-4 font-semibold text-white"><Plus size={18} /> 과제 등록</Link>}
      </div>
      {query.success === "archived" && <p className="mt-5 rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-200">과제를 삭제했습니다. 제출 기록은 안전하게 보관됩니다.</p>}
      {query.error === "not_found" && <p className="mt-5 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700 dark:bg-red-950/50 dark:text-red-200">이미 삭제되었거나 찾을 수 없는 과제입니다.</p>}
      {assignments.length ? <div className="mt-6 grid gap-4 md:grid-cols-2">{assignments.map((assignment) => { const status = getAssignmentTimingStatus(assignment); return <Link key={assignment.id} href={`/organizations/${organizationId}/assignments/${assignment.id}`}><Card className="group h-full transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md"><div className="flex flex-wrap items-center justify-between gap-2"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold dark:bg-slate-800">{STATUS_LABELS[status]}</span><strong className={status === "OPEN" ? "text-indigo-600" : "text-slate-500"}>{getDeadlineLabel(assignment.deadline)}</strong></div><h2 className="mt-4 text-lg font-bold">{assignment.title}</h2><p className="mt-2 line-clamp-2 text-sm text-slate-500">{assignment.description}</p><p className="mt-4 text-xs text-slate-500">마감 {formatKoreanDateTime(assignment.deadline)} · {assignment.createdBy.name}</p></Card></Link>; })}</div> : <Card className="mt-6 border-dashed text-center"><ClipboardList className="mx-auto text-slate-400" /><p className="mt-3 font-semibold">표시할 과제가 없습니다</p></Card>}
    </div>
  );
}
