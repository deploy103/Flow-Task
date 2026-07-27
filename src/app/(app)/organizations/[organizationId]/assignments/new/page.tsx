import { AssignmentFieldType, MembershipStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { BackLink } from "@/components/ui/back-link";
import { createAssignment } from "@/features/assignment/actions";
import { AssignmentAudienceField } from "@/features/assignment/components/assignment-audience-field";
import { requireOrganizationAccess } from "@/features/organization/guards";
import { formatKoreanDateTimeInput } from "@/lib/date";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_ASSIGNMENT_DEADLINE_DAYS,
  MAX_ASSIGNMENT_DESCRIPTION_LENGTH,
  MAX_ASSIGNMENT_TITLE_LENGTH,
  MILLISECONDS_PER_DAY,
  ASSIGNMENT_FIELD_LABELS,
  ASSIGNMENT_SETUP_OPTIONS,
  ASSIGNMENT_SETUP_TYPE,
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
      <BackLink href={`/organizations/${organizationId}/assignments`} label="과제 목록" />
      <p className="text-sm font-semibold text-indigo-600">관리자 전용</p><h1 className="mt-1 text-3xl font-bold">과제 만들기</h1><p className="mt-2 text-slate-500">과제 종류를 고르고 기본 정보를 저장하면 다음 구성 단계로 바로 이어집니다.</p>
      <Card className="mt-6">
        {error && <p role="alert" className="mb-5 rounded-xl bg-red-50 p-3 text-sm text-red-700">입력 내용, 날짜와 과제 대상을 확인해 주세요.</p>}
        <form action={createAssignment} className="space-y-5">
          <input type="hidden" name="organizationId" value={organizationId} />
          <fieldset>
            <legend className="text-sm font-bold">무엇을 만들까요?</legend>
            <p className="mt-1 text-xs text-slate-500">하나를 선택하면 과제 저장 후 알맞은 설정 화면으로 이동합니다.</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {ASSIGNMENT_SETUP_OPTIONS.map((option) => (
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-4 transition hover:border-indigo-400 has-[:checked]:border-indigo-600 has-[:checked]:bg-indigo-50 dark:border-slate-700 dark:has-[:checked]:bg-indigo-950/50" key={option.value}>
                  <input className="mt-1" defaultChecked={option.value === ASSIGNMENT_SETUP_TYPE.GENERAL_SUBMISSION} name="setupType" type="radio" value={option.value} />
                  <span><strong className="block text-sm">{option.label}</strong><span className="mt-1 block text-xs leading-5 text-slate-500">{option.description}</span></span>
                </label>
              ))}
            </div>
          </fieldset>
          <label className="block text-sm font-medium">과제 제목<Input name="title" required maxLength={MAX_ASSIGNMENT_TITLE_LENGTH} className="mt-2" /></label>
          <label className="block text-sm font-medium">과제 설명<textarea name="description" required maxLength={MAX_ASSIGNMENT_DESCRIPTION_LENGTH} rows={10} className="mt-2 w-full rounded-xl border border-slate-200 bg-white p-3 text-slate-900 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white" /></label>
          <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium">공개일 (KST)<Input type="datetime-local" name="opensAt" required defaultValue={formatKoreanDateTimeInput(now)} className="mt-2" /></label><label className="text-sm font-medium">마감일 (KST)<Input type="datetime-local" name="deadline" required defaultValue={formatKoreanDateTimeInput(defaultDeadline)} className="mt-2" /></label></div>
          <label className="flex items-center gap-3 rounded-xl bg-slate-50 p-4 text-sm font-medium dark:bg-slate-800"><input type="checkbox" name="allowLate" /> 마감 후 지각 제출 허용</label>
          <fieldset><legend className="text-sm font-medium">일반 제출 항목 <span className="text-slate-400">(선택)</span></legend><p className="mt-1 text-xs text-slate-500">기본은 제출 내용 하나입니다. 퀴즈나 문제만 운영한다면 모두 해제해도 됩니다.</p><div className="mt-3 grid gap-2 sm:grid-cols-3">{Object.values(AssignmentFieldType).map((type) => <label key={type} className="flex items-center gap-3 rounded-xl border border-slate-200 p-4 text-sm font-medium dark:border-slate-700"><input type="checkbox" name="fieldTypes" value={type} defaultChecked={type === AssignmentFieldType.TEXT} /> {ASSIGNMENT_FIELD_LABELS[type]}</label>)}</div></fieldset>
          <AssignmentAudienceField members={members.map(({ user }) => user)} />
          <Button type="submit">과제 저장하고 계속</Button>
        </form>
      </Card>
    </div>
  );
}
