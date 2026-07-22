import { DepartmentRole, MembershipStatus } from "@prisma/client";
import { notFound } from "next/navigation";
import { BackLink } from "@/components/ui/back-link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DEPARTMENT_MESSAGE_PAGE_SIZE, DEPARTMENT_ROLE_LABELS, MAX_DEPARTMENT_MESSAGE_LENGTH } from "@/constants/department";
import { sendDepartmentMessage, updateDepartmentMembers } from "@/features/department/actions";
import { requireDepartmentAccess } from "@/features/department/guards";
import { canManageOrganization } from "@/features/organization/permissions";
import { formatKoreanDateTime } from "@/lib/date";
import { prisma } from "@/lib/prisma";

export default async function DepartmentPage({ params, searchParams }: { params: Promise<{ organizationId: string; departmentId: string }>; searchParams: Promise<{ error?: string; message?: string }> }) {
  const { organizationId, departmentId } = await params;
  const notice = await searchParams;
  const { user, membership } = await requireDepartmentAccess(organizationId, departmentId);
  const canManage = canManageOrganization({ systemRole: user.systemRole, membership });
  const [department, organizationMembers] = await Promise.all([
    prisma.department.findFirst({
      where: { id: departmentId, organizationId, archivedAt: null },
      include: {
        members: { include: { user: { select: { id: true, name: true, email: true } } }, orderBy: [{ role: "desc" }, { joinedAt: "asc" }] },
        messages: { include: { author: { select: { id: true, name: true } } }, orderBy: { createdAt: "desc" }, take: DEPARTMENT_MESSAGE_PAGE_SIZE },
      },
    }),
    canManage ? prisma.organizationMember.findMany({ where: { organizationId, status: MembershipStatus.ACTIVE }, include: { user: { select: { id: true, name: true, email: true } } }, orderBy: { user: { name: "asc" } } }) : Promise.resolve([]),
  ]);
  if (!department) notFound();
  const memberIds = new Set(department.members.map(({ userId }) => userId));
  const leaderId = department.members.find(({ role }) => role === DepartmentRole.LEAD)?.userId ?? "";
  const messages = department.messages.reverse();

  return <div className="max-w-4xl"><BackLink href={`/organizations/${organizationId}/departments`} label="부서 목록"/><h1 className="text-3xl font-bold">{department.name}</h1><p className="mt-2 text-slate-500">{department.description ?? "부서 구성원 전용 공간입니다."}</p>
    {(notice.error || notice.message) && <p role="status" className={`mt-5 rounded-xl p-3 text-sm ${notice.error ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>{notice.error ? notice.error === "message_failed" ? "메시지를 보내지 못했습니다. 소속과 입력 내용을 확인해 주세요." : "구성원 설정을 저장하지 못했습니다." : notice.message === "members_updated" ? "부서 구성을 저장했습니다." : "메시지를 보냈습니다."}</p>}
    <Card className="mt-6"><h2 className="text-lg font-bold">부서 구성원</h2><div className="mt-3 flex flex-wrap gap-2">{department.members.map(({ user: member, role }) => <span key={member.id} className="rounded-full bg-slate-100 px-3 py-1.5 text-sm dark:bg-slate-800">{member.name} · {DEPARTMENT_ROLE_LABELS[role]}</span>)}{department.members.length === 0 && <span className="text-sm text-slate-500">아직 배정된 구성원이 없습니다.</span>}</div></Card>
    {canManage && <Card className="mt-6"><h2 className="text-lg font-bold">구성원 배정</h2><p className="mt-1 text-sm text-slate-500">한 명의 부서장을 지정할 수 있으며 부서장은 자동으로 부서원에 포함됩니다.</p><form action={updateDepartmentMembers} className="mt-4 space-y-4"><input type="hidden" name="organizationId" value={organizationId}/><input type="hidden" name="departmentId" value={departmentId}/><label className="block text-sm font-medium">부서장<select name="leaderId" defaultValue={leaderId} className="mt-2 min-h-11 w-full rounded-xl border px-3 dark:bg-slate-900"><option value="">미지정</option>{organizationMembers.map(({ user: member }) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label><fieldset><legend className="text-sm font-medium">부서원</legend><div className="mt-2 grid max-h-72 gap-2 overflow-y-auto rounded-xl border p-3 sm:grid-cols-2">{organizationMembers.map(({ user: member }) => <label key={member.id} className="flex items-start gap-2 rounded-lg p-2 text-sm"><input type="checkbox" name="memberIds" value={member.id} defaultChecked={memberIds.has(member.id)} className="mt-1"/><span>{member.name}<span className="block text-xs text-slate-500">{member.email}</span></span></label>)}</div></fieldset><Button>구성 저장</Button></form></Card>}
    <Card className="mt-6"><h2 className="text-lg font-bold">부서 채팅</h2><div className="mt-4 max-h-[32rem] space-y-3 overflow-y-auto rounded-xl bg-slate-50 p-4 dark:bg-slate-950">{messages.map((message) => <article key={message.id} className="rounded-xl bg-white p-3 shadow-sm dark:bg-slate-900"><div className="flex flex-wrap items-baseline justify-between gap-2"><strong className="text-sm">{message.author.name}</strong><time className="text-xs text-slate-400">{formatKoreanDateTime(message.createdAt)}</time></div><p className="mt-2 whitespace-pre-wrap break-words text-sm">{message.content}</p></article>)}{messages.length === 0 && <p className="text-sm text-slate-500">첫 메시지를 남겨 보세요.</p>}</div><form action={sendDepartmentMessage} className="mt-4 flex gap-2"><input type="hidden" name="organizationId" value={organizationId}/><input type="hidden" name="departmentId" value={departmentId}/><textarea name="content" required maxLength={MAX_DEPARTMENT_MESSAGE_LENGTH} rows={2} className="min-h-16 flex-1 rounded-xl border p-3 dark:bg-slate-900" placeholder="부서 구성원에게 메시지 보내기"/><Button>전송</Button></form></Card>
  </div>;
}
