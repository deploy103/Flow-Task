import { MembershipStatus } from "@prisma/client";
import { ArrowRight, Building2, Plus } from "lucide-react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requireAuthenticatedUser } from "@/features/auth/guards";
import { joinOrganization } from "@/features/organization/actions";
import { prisma } from "@/lib/prisma";

const ERROR_MESSAGES: Record<string, string> = {
  invalid_invitation: "초대 코드 형식을 확인해 주세요.",
  invitation_unavailable: "만료되었거나 사용할 수 없는 초대 코드입니다.",
};

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const user = await requireAuthenticatedUser();
  const { error } = await searchParams;
  const memberships = await prisma.organizationMember.findMany({
    where: { userId: user.id, status: MembershipStatus.ACTIVE },
    include: { organization: true },
    orderBy: { joinedAt: "asc" },
  });

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-sm font-semibold text-indigo-600">대시보드</p><h1 className="mt-1 text-3xl font-bold">{user.name}님의 조직</h1></div>
        <Link href="/organizations/new" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-indigo-600 px-4 font-semibold text-white"><Plus size={18} /> 조직 만들기</Link>
      </div>

      <section className="mt-8">
        <h2 className="text-xl font-bold">내 조직</h2>
        {memberships.length ? (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {memberships.map(({ organization, role }) => (
              <Link key={organization.id} href={`/organizations/${organization.id}`}>
                <Card className="group h-full transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md">
                  <div className="flex items-start justify-between"><span className="rounded-xl bg-indigo-50 p-3 text-indigo-600 dark:bg-indigo-950"><Building2 /></span><ArrowRight className="text-slate-400 transition group-hover:translate-x-1" /></div>
                  <h3 className="mt-5 text-lg font-bold">{organization.name}</h3>
                  <p className="mt-1 line-clamp-2 text-sm text-slate-500">{organization.description ?? "등록된 조직 설명이 없습니다."}</p>
                  <span className="mt-4 inline-block rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold dark:bg-slate-800">{role}</span>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <Card className="mt-4 border-dashed text-center"><Building2 className="mx-auto text-slate-400" /><p className="mt-3 font-semibold">가입한 조직이 없습니다</p><p className="mt-1 text-sm text-slate-500">조직을 만들거나 관리자에게 받은 초대 코드로 가입하세요.</p></Card>
        )}
      </section>

      <Card className="mt-8 max-w-xl">
        <h2 className="font-bold">초대 코드로 가입</h2>
        <p className="mt-1 text-sm text-slate-500">관리자에게 받은 12자리 코드를 입력하세요.</p>
        {error && <p role="alert" className="mt-3 text-sm text-red-600">{ERROR_MESSAGES[error] ?? "가입 요청을 처리할 수 없습니다."}</p>}
        <form action={joinOrganization} className="mt-4 flex flex-col gap-3 sm:flex-row">
          <Input name="invitationCode" required minLength={12} maxLength={12} className="uppercase" placeholder="AB12CD34EF56" aria-label="초대 코드" />
          <Button type="submit" className="shrink-0">조직 가입</Button>
        </form>
      </Card>
    </div>
  );
}
