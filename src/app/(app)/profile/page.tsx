import { MembershipRole, MembershipStatus } from "@prisma/client";
import { changePassword, logout, updateProfile } from "@/features/auth/actions";
import { requireAuthenticatedUser } from "@/features/auth/guards";
import { leaveOrganization } from "@/features/organization/actions";
import { MEMBERSHIP_ROLE_LABELS } from "@/constants/roles";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { calculateAge, formatDateOnly } from "@/features/auth/birth-date";
import { prisma } from "@/lib/prisma";

const ERROR_MESSAGES: Record<string, string> = {
  invalid_input: "프로필 입력 내용을 확인해 주세요.",
  update_failed: "프로필을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.",
  invalid_password_change: "비밀번호 입력과 확인 값을 다시 확인해 주세요.",
  current_password_incorrect: "현재 비밀번호가 올바르지 않습니다.",
  password_change_failed: "비밀번호를 변경하지 못했습니다. 잠시 후 다시 시도해 주세요.",
  password_change_rate_limited: "비밀번호 확인 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
  invalid_leave_request: "동아리 탈퇴 요청을 확인해 주세요.",
  organization_name_mismatch: "입력한 동아리 이름이 일치하지 않습니다.",
  last_organization_admin: "마지막 동아리 관리자는 탈퇴할 수 없습니다. 다른 구성원에게 관리자 역할을 먼저 부여하세요.",
  leave_failed: "동아리에서 탈퇴하지 못했습니다. 잠시 후 다시 시도해 주세요.",
};

const MESSAGE_MESSAGES: Record<string, string> = {
  updated: "프로필을 저장했습니다.",
  organization_left: "동아리 탈퇴를 완료했습니다.",
};

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string }> }) {
  const user = await requireAuthenticatedUser();
  const notice = await searchParams;
  const memberships = await prisma.organizationMember.findMany({
    where: { userId: user.id, status: MembershipStatus.ACTIVE },
    select: { role: true, organization: { select: { id: true, name: true } } },
    orderBy: { joinedAt: "asc" },
  });

  return (
    <div className="max-w-3xl">
      <h1 className="text-3xl font-bold">내 정보</h1>
      <p className="mt-2 text-slate-500">프로필, 비밀번호, 로그인 상태와 가입 동아리를 관리합니다.</p>

      {notice.error && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-200">{ERROR_MESSAGES[notice.error] ?? "요청을 처리할 수 없습니다."}</p>}
      {notice.message && MESSAGE_MESSAGES[notice.message] && <p role="status" className="mt-5 rounded-xl bg-green-50 p-3 text-sm text-green-700 dark:bg-green-950/50 dark:text-green-200">{MESSAGE_MESSAGES[notice.message]}</p>}

      <Card className="mt-6">
        <h2 className="text-lg font-bold">기본 정보</h2>
        <p className="mt-1 text-sm text-slate-500">이 정보는 소속 동아리의 구성원 및 제출 현황에 표시됩니다.</p>
        <form action={updateProfile} className="mt-5 space-y-4">
          <label className="block text-sm font-medium">이메일<Input value={user.email} disabled className="mt-2 opacity-70" /></label>
          <label className="block text-sm font-medium">이름<Input name="name" defaultValue={user.name} required minLength={2} maxLength={50} className="mt-2" /></label>
          <label className="block text-sm font-medium">생년월일 <span className="text-slate-400">(기존 계정은 선택)</span><Input name="birthDate" type="date" defaultValue={user.birthDate ? formatDateOnly(user.birthDate) : ""} className="mt-2" />{user.birthDate && <span className="mt-1 block text-xs font-normal text-slate-500">현재 만 {calculateAge(user.birthDate)}세</span>}</label>
          <label className="block text-sm font-medium">학번<Input name="studentNumber" defaultValue={user.studentNumber ?? ""} maxLength={30} className="mt-2" /></label>
          <Button type="submit">변경사항 저장</Button>
        </form>
      </Card>

      <Card className="mt-6 scroll-mt-28" id="security">
        <h2 className="text-lg font-bold">비밀번호와 로그인</h2>
        <p className="mt-1 text-sm text-slate-500">비밀번호를 변경하면 모든 기기에서 로그아웃됩니다.</p>
        <form action={changePassword} className="mt-5 space-y-4">
          <label className="block text-sm font-medium">현재 비밀번호<Input autoComplete="current-password" className="mt-2" maxLength={128} minLength={8} name="currentPassword" required type="password" /></label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium">새 비밀번호<Input autoComplete="new-password" className="mt-2" maxLength={128} minLength={8} name="newPassword" required type="password" /></label>
            <label className="block text-sm font-medium">새 비밀번호 확인<Input autoComplete="new-password" className="mt-2" maxLength={128} minLength={8} name="newPasswordConfirmation" required type="password" /></label>
          </div>
          <Button type="submit">비밀번호 변경</Button>
        </form>
        <div className="mt-6 border-t border-slate-200 pt-5 dark:border-slate-800">
          <p className="text-sm text-slate-500">현재 기기의 세션만 종료하려면 로그아웃하세요.</p>
          <form action={logout} className="mt-3"><Button className="bg-slate-700 hover:bg-slate-800" type="submit">현재 기기에서 로그아웃</Button></form>
        </div>
      </Card>

      <section className="mt-8 scroll-mt-28" id="organizations" aria-labelledby="joined-organizations-heading">
        <h2 className="text-xl font-bold" id="joined-organizations-heading">가입 동아리</h2>
        <p className="mt-1 text-sm text-slate-500">탈퇴하면 해당 동아리의 비공개 자료와 부서에 더 이상 접근할 수 없습니다.</p>
        <div className="mt-4 space-y-4">
          {memberships.map(({ organization, role }) => (
            <Card key={organization.id}>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="font-bold">{organization.name}</h3>
                  <p className="mt-1 text-sm text-slate-500">{MEMBERSHIP_ROLE_LABELS[role]}</p>
                  {role === MembershipRole.ORG_ADMIN && <p className="mt-2 text-xs font-medium text-amber-700 dark:text-amber-300">마지막 관리자라면 다른 구성원에게 관리자 역할을 부여한 뒤 탈퇴할 수 있습니다.</p>}
                </div>
                <form action={leaveOrganization} className="w-full max-w-sm space-y-2">
                  <input name="organizationId" type="hidden" value={organization.id} />
                  <label className="block text-xs font-medium">확인을 위해 동아리 이름 입력<Input aria-label={`${organization.name} 탈퇴 확인 이름`} className="mt-1" maxLength={80} name="confirmationName" placeholder={organization.name} required /></label>
                  <Button className="w-full bg-red-600 hover:bg-red-700" type="submit">동아리 탈퇴</Button>
                </form>
              </div>
            </Card>
          ))}
          {!memberships.length && <Card className="border-dashed text-center text-sm text-slate-500">현재 가입한 동아리가 없습니다.</Card>}
        </div>
      </section>
    </div>
  );
}
