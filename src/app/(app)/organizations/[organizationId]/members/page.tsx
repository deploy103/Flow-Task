import { MembershipRole, MembershipStatus } from "@prisma/client";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MEMBERSHIP_ROLE_DESCRIPTIONS, MEMBERSHIP_ROLE_LABELS } from "@/constants/roles";
import { BackLink } from "@/components/ui/back-link";
import { removeOrganizationMember, updateMemberRole } from "@/features/organization/actions";
import { InvitationForm } from "@/features/organization/components/invitation-form";
import { requireOrganizationAccess } from "@/features/organization/guards";
import { prisma } from "@/lib/prisma";

export default async function MembersPage({
  params,
  searchParams,
}: {
  params: Promise<{ organizationId: string }>;
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const { organizationId } = await params;
  const notice = await searchParams;
  const { user: currentUser } = await requireOrganizationAccess(organizationId, true);
  const organization = await prisma.organization.findFirst({
    where: { id: organizationId, archivedAt: null },
    include: {
      members: {
        where: { status: MembershipStatus.ACTIVE },
        include: { user: true },
        orderBy: [{ role: "desc" }, { joinedAt: "asc" }],
      },
    },
  });
  if (!organization) notFound();
  const roleCounts = Object.fromEntries(Object.values(MembershipRole).map((role) => [role, organization.members.filter((member) => member.role === role).length])) as Record<MembershipRole, number>;

  return (
    <div>
      <BackLink href={`/organizations/${organizationId}`} label="조직 홈"/><p className="text-sm font-semibold text-indigo-600">{organization.name}</p><h1 className="mt-1 text-3xl font-bold">구성원 관리</h1><p className="mt-2 text-slate-500">초대 코드는 해시로만 저장되며 발급 직후 한 번만 표시됩니다.</p>
      {notice.error && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">{{ role_update_failed: "역할을 변경할 수 없습니다. 마지막 관리자는 관리자 역할을 유지해야 합니다.", last_admin: "마지막 조직 관리자는 내보낼 수 없습니다. 다른 구성원에게 관리자 역할을 먼저 부여하세요.", confirmation_mismatch: "구성원 이름이 일치하지 않아 내보내지 않았습니다.", self_removal: "자신은 이 화면에서 내보낼 수 없습니다. 프로필의 동아리 탈퇴를 이용하세요.", remove_failed: "구성원을 내보낼 수 없습니다. 소속 상태를 확인하고 다시 시도하세요." }[notice.error] ?? "요청을 처리할 수 없습니다."}</p>}
      {notice.message === "role_updated" && <p className="mt-5 rounded-xl bg-green-50 p-3 text-sm text-green-700 dark:bg-green-950 dark:text-green-200">구성원 역할을 변경했습니다.</p>}
      {notice.message === "member_removed" && <p className="mt-5 rounded-xl bg-green-50 p-3 text-sm text-green-700 dark:bg-green-950 dark:text-green-200">구성원을 조직에서 내보냈습니다.</p>}
      <Card className="mt-6"><h2 className="text-lg font-bold">초대 코드 만들기</h2><p className="mb-5 mt-1 text-sm text-slate-500">관리자 역할은 기존 관리자가 가입 후 직접 부여해야 합니다.</p><InvitationForm organizationId={organizationId} /></Card>
      <div className="mt-6 grid gap-3 md:grid-cols-3">{Object.values(MembershipRole).map((role) => <Card key={role}><p className="text-sm font-semibold text-indigo-600">{MEMBERSHIP_ROLE_LABELS[role]} · {roleCounts[role]}명</p><p className="mt-2 text-sm text-slate-500">{MEMBERSHIP_ROLE_DESCRIPTIONS[role]}</p></Card>)}</div>
      <Card className="mt-6 overflow-hidden p-0">
        <div className="border-b border-slate-200 p-5 dark:border-slate-800"><h2 className="text-lg font-bold">구성원 {organization.members.length}명</h2></div>
        <ul className="divide-y divide-slate-200 dark:divide-slate-800">
          {organization.members.map((member) => (
            <li key={member.userId} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div><p className="font-semibold">{member.user.name}</p><p className="mt-1 text-sm text-slate-500">{member.user.email}{member.user.studentNumber ? ` · ${member.user.studentNumber}` : ""}</p><span className="mt-2 inline-block rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold dark:bg-slate-800">{MEMBERSHIP_ROLE_LABELS[member.role]}</span></div>
              <div className="flex flex-col items-stretch gap-2 sm:items-end"><form action={updateMemberRole} className="flex gap-2">
                <input type="hidden" name="organizationId" value={organizationId} /><input type="hidden" name="memberId" value={member.userId} />
                <select name="role" defaultValue={member.role} aria-label={`${member.user.name} 역할`} className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-900">
                  {Object.values(MembershipRole).map((role) => <option key={role} value={role}>{MEMBERSHIP_ROLE_LABELS[role]}</option>)}
                </select>
                <Button type="submit">저장</Button>
              </form>{member.userId === currentUser.id ? <span className="text-xs font-semibold text-slate-400">현재 내 계정</span> : <details className="w-full max-w-sm rounded-xl border border-red-200 p-3 dark:border-red-900"><summary className="cursor-pointer text-sm font-semibold text-red-600">조직에서 내보내기</summary><form action={removeOrganizationMember} className="mt-3 space-y-3"><input type="hidden" name="organizationId" value={organizationId} /><input type="hidden" name="memberId" value={member.userId} /><label className="block text-xs text-slate-500">확인을 위해 <strong>{member.user.name}</strong>을(를) 입력하세요.<input autoComplete="off" className="mt-2 min-h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900" maxLength={100} name="confirmationName" required /></label><Button className="min-h-10 bg-red-600 hover:bg-red-700" type="submit">구성원 내보내기</Button></form></details>}</div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
