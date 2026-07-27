import { MembershipStatus, SystemRole } from "@prisma/client";
import { ArrowRight, Building2, KeyRound, Plus, ShieldCheck, Users } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MEMBERSHIP_ROLE_LABELS } from "@/constants/roles";
import { requireAuthenticatedUser } from "@/features/auth/guards";
import { joinOrganization } from "@/features/organization/actions";
import { prisma } from "@/lib/prisma";

const ERROR_MESSAGES: Record<string, string> = {
  invalid_invitation: "초대 코드는 영문과 숫자로 이루어진 12자리입니다.",
  invitation_unavailable: "만료되었거나 이미 모두 사용된 초대 코드입니다.",
};

export default async function OrganizationsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const [user, query] = await Promise.all([requireAuthenticatedUser(), searchParams]);
  const isSystemAdmin = user.systemRole === SystemRole.SYSTEM_ADMIN;
  const memberships = await prisma.organizationMember.findMany({
    where: { userId: user.id, status: MembershipStatus.ACTIVE, organization: { archivedAt: null } },
    select: {
      role: true,
      joinedAt: true,
      organization: {
        select: { id: true, name: true, description: true, _count: { select: { members: true } } },
      },
    },
    orderBy: { joinedAt: "asc" },
  });
  const managedOrganizations = isSystemAdmin
    ? await prisma.organization.findMany({
        where: { archivedAt: null, members: { none: { userId: user.id, status: MembershipStatus.ACTIVE } } },
        select: { id: true, name: true, description: true, _count: { select: { members: true } } },
        orderBy: { createdAt: "asc" },
      })
    : [];
  const hasOrganizations = memberships.length > 0 || managedOrganizations.length > 0;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-indigo-600">내 활동 공간</p>
          <h1 className="mt-1 text-3xl font-bold">조직 보기</h1>
          <p className="mt-2 text-slate-500">가입한 조직을 열거나 새 조직 활동을 시작하세요.</p>
        </div>
        <Link
          href="/organizations/new"
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-indigo-600 px-4 font-semibold text-white transition hover:bg-indigo-700"
        >
          <Plus size={18} /> 조직 만들기
        </Link>
      </div>

      {hasOrganizations ? (
        <section className="mt-8" aria-labelledby="organization-list-heading">
          <h2 id="organization-list-heading" className="text-xl font-bold">내가 볼 수 있는 조직</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {memberships.map(({ organization, role }) => (
              <OrganizationCard
                key={organization.id}
                organization={organization}
                badge={MEMBERSHIP_ROLE_LABELS[role]}
              />
            ))}
            {managedOrganizations.map((organization) => (
              <OrganizationCard
                key={organization.id}
                organization={organization}
                badge="시스템 관리자"
                systemAdmin
              />
            ))}
          </div>
        </section>
      ) : (
        <Card className="mt-8 border-dashed px-6 py-10 text-center">
          <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950">
            <Building2 aria-hidden="true" />
          </span>
          <h2 className="mt-4 text-xl font-bold">가입된 조직이 없습니다</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
            직접 조직을 만들거나, 관리자에게 받은 초대 코드로 기존 조직에 가입하세요.
          </p>
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href="/organizations/new"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 font-semibold text-white transition hover:bg-indigo-700"
            >
              <Plus size={18} /> 새 조직 만들기
            </Link>
            <a
              href="#join-organization"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 font-semibold transition hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              <KeyRound size={18} /> 초대 코드로 가입
            </a>
          </div>
        </Card>
      )}

      <Card className="mt-8 max-w-2xl" id="join-organization">
        <div className="flex items-start gap-3">
          <span className="rounded-xl bg-slate-100 p-2.5 text-slate-600 dark:bg-slate-800 dark:text-slate-300"><KeyRound size={20} /></span>
          <div>
            <h2 className="font-bold">초대 코드로 가입하기</h2>
            <p className="mt-1 text-sm text-slate-500">조직 관리자에게 받은 12자리 코드를 입력하세요.</p>
          </div>
        </div>
        {query.error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700 dark:bg-red-950 dark:text-red-200">{ERROR_MESSAGES[query.error] ?? "가입 요청을 처리할 수 없습니다."}</p>}
        <form action={joinOrganization} className="mt-5 flex flex-col gap-3 sm:flex-row">
          <Input
            aria-label="조직 초대 코드"
            autoCapitalize="characters"
            className="uppercase"
            maxLength={12}
            minLength={12}
            name="invitationCode"
            placeholder="AB12CD34EF56"
            required
          />
          <Button className="shrink-0" type="submit">조직 가입</Button>
        </form>
      </Card>
    </div>
  );
}

function OrganizationCard({
  organization,
  badge,
  systemAdmin = false,
}: {
  organization: { id: string; name: string; description: string | null; _count: { members: number } };
  badge: string;
  systemAdmin?: boolean;
}) {
  return (
    <Link href={`/organizations/${organization.id}`}>
      <Card className="group h-full transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md">
        <div className="flex items-start justify-between gap-4">
          <span className="rounded-xl bg-indigo-50 p-3 text-indigo-600 dark:bg-indigo-950">
            {systemAdmin ? <ShieldCheck aria-hidden="true" /> : <Building2 aria-hidden="true" />}
          </span>
          <ArrowRight aria-hidden="true" className="text-slate-400 transition group-hover:translate-x-1" />
        </div>
        <h3 className="mt-5 text-lg font-bold">{organization.name}</h3>
        <p className="mt-1 line-clamp-2 text-sm text-slate-500">{organization.description ?? "등록된 조직 설명이 없습니다."}</p>
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-semibold">
          <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-200">{badge}</span>
          <span className="inline-flex items-center gap-1 text-slate-500"><Users size={14} /> 구성원 {organization._count.members}명</span>
        </div>
      </Card>
    </Link>
  );
}
