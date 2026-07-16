import { AssignmentAudience, AssignmentFieldType, MembershipStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createAssignment } from "@/features/assignment/actions";
import { requireOrganizationAccess } from "@/features/organization/guards";
import { formatKoreanDateTimeInput } from "@/lib/date";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_ASSIGNMENT_DEADLINE_DAYS,
  MAX_ASSIGNMENT_DESCRIPTION_LENGTH,
  MAX_ASSIGNMENT_TITLE_LENGTH,
  MILLISECONDS_PER_DAY,
  ASSIGNMENT_FIELD_LABELS,
} from "@/constants/assignment";

export default async function NewAssignmentPage({ params, searchParams }: { params: Promise<{ organizationId: string }>; searchParams: Promise<{ error?: string }> }) {
  const { organizationId } = await params;
  const { error } = await searchParams;
  await requireOrganizationAccess(organizationId, true);
  const members = await prisma.organizationMember.findMany({ where: { organizationId, status: MembershipStatus.ACTIVE }, include: { user: { select: { id: true, name: true, email: true } } }, orderBy: { user: { name: "asc" } } });
  const now = new Date();
  const defaultDeadline = new Date(
    now.getTime() + DEFAULT_ASSIGNMENT_DEADLINE_DAYS * MILLISECONDS_PER_DAY,
  );

  return (
    <div className="max-w-3xl">
      <p className="text-sm font-semibold text-indigo-600">관리자 전용</p><h1 className="mt-1 text-3xl font-bold">과제 등록</h1><p className="mt-2 text-slate-500">기본 정보와 공개 대상을 설정하세요.</p>
      <Card className="mt-6">
        {error && <p role="alert" className="mb-5 rounded-xl bg-red-50 p-3 text-sm text-red-700">입력 내용, 날짜와 과제 대상을 확인해 주세요.</p>}
        <form action={createAssignment} className="space-y-5">
          <input type="hidden" name="organizationId" value={organizationId} />
          <label className="block text-sm font-medium">과제 제목<Input name="title" required maxLength={MAX_ASSIGNMENT_TITLE_LENGTH} className="mt-2" /></label>
          <label className="block text-sm font-medium">과제 설명<textarea name="description" required maxLength={MAX_ASSIGNMENT_DESCRIPTION_LENGTH} rows={10} className="mt-2 w-full rounded-xl border border-slate-200 bg-white p-3 text-slate-900 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white" /></label>
          <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium">공개일 (KST)<Input type="datetime-local" name="opensAt" required defaultValue={formatKoreanDateTimeInput(now)} className="mt-2" /></label><label className="text-sm font-medium">마감일 (KST)<Input type="datetime-local" name="deadline" required defaultValue={formatKoreanDateTimeInput(defaultDeadline)} className="mt-2" /></label></div>
          <label className="flex items-center gap-3 rounded-xl bg-slate-50 p-4 text-sm font-medium dark:bg-slate-800"><input type="checkbox" name="allowLate" /> 마감 후 지각 제출 허용</label>
          <fieldset><legend className="text-sm font-medium">제출 항목</legend><div className="mt-3 grid gap-2 sm:grid-cols-3">{Object.values(AssignmentFieldType).map((type) => <label key={type} className="flex items-center gap-3 rounded-xl border border-slate-200 p-4 text-sm font-medium dark:border-slate-700"><input type="checkbox" name="fieldTypes" value={type} defaultChecked /> {ASSIGNMENT_FIELD_LABELS[type]}</label>)}</div></fieldset>
          <label className="block text-sm font-medium">과제 대상<select name="audience" defaultValue={AssignmentAudience.ALL_MEMBERS} className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-900"><option value={AssignmentAudience.ALL_MEMBERS}>전체 구성원</option><option value={AssignmentAudience.SELECTED_MEMBERS}>선택한 구성원</option></select></label>
          <fieldset><legend className="text-sm font-medium">개별 대상 선택 <span className="text-slate-400">(선택 공개일 때 적용)</span></legend><div className="mt-3 grid max-h-64 gap-2 overflow-y-auto rounded-xl border border-slate-200 p-3 dark:border-slate-700 sm:grid-cols-2">{members.map(({ user }) => <label key={user.id} className="flex items-start gap-2 rounded-lg p-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800"><input type="checkbox" name="targetUserIds" value={user.id} className="mt-1" /><span><strong className="block">{user.name}</strong><span className="text-slate-500">{user.email}</span></span></label>)}</div></fieldset>
          <Button type="submit">과제 등록</Button>
        </form>
      </Card>
    </div>
  );
}
