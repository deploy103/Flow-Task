import { MembershipStatus } from "@prisma/client";
import { ArrowRight, BarChart3, Bell, CalendarDays, CircleHelp, ClipboardList, MessageSquare, Settings, Users } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { MEMBERSHIP_ROLE_LABELS } from "@/constants/roles";
import { requireOrganizationAccess } from "@/features/organization/guards";
import { canManageOrganization } from "@/features/organization/permissions";
import { prisma } from "@/lib/prisma";

export default async function OrganizationPage({ params }: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await params;
  const { user, membership } = await requireOrganizationAccess(organizationId);
  const organization = await prisma.organization.findFirst({
    where: { id: organizationId, archivedAt: null },
    include: { _count: { select: { members: { where: { status: MembershipStatus.ACTIVE } } } } },
  });
  if (!organization) notFound();
  const canManage = canManageOrganization({ systemRole: user.systemRole, membership });

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">{organization.logoStoragePath && <Image src={`/api/organizations/${organizationId}/logo`} alt={`${organization.name} 로고`} width={72} height={72} unoptimized className="size-16 rounded-2xl border object-cover sm:size-[72px]"/>}<div><p className="text-sm font-semibold text-indigo-600">{membership ? MEMBERSHIP_ROLE_LABELS[membership.role] : "시스템 관리자"}</p><h1 className="mt-1 text-3xl font-bold">{organization.name}</h1><p className="mt-2 max-w-2xl text-slate-500">{organization.description ?? "등록된 조직 설명이 없습니다."}</p></div></div>
        {canManage && <Link href={`/organizations/${organizationId}/settings`} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-indigo-600 px-4 font-semibold text-white"><Settings size={18} /> 조직 설정</Link>}
      </div>
      <section className="mt-8" aria-labelledby="organization-activity-heading">
        <div>
          <h2 className="text-xl font-bold" id="organization-activity-heading">활동</h2>
          <p className="mt-1 text-sm text-slate-500">구성원이 자주 사용하는 메뉴입니다.</p>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Link href={`/organizations/${organizationId}/assignments`} className="block">
            <Card className="group h-full"><div className="flex items-center justify-between"><span className="rounded-xl bg-indigo-50 p-3 text-indigo-600 dark:bg-indigo-950"><ClipboardList /></span><ArrowRight className="text-slate-400 transition group-hover:translate-x-1" /></div><h3 className="mt-5 font-bold">과제</h3><p className="mt-1 text-sm text-slate-500">공개된 과제와 마감 일정을 확인합니다.</p></Card>
          </Link>
          <Link href={`/organizations/${organizationId}/announcements`} className="block">
            <Card className="group h-full"><div className="flex items-center justify-between"><span className="rounded-xl bg-amber-50 p-3 text-amber-600 dark:bg-amber-950"><Bell /></span><ArrowRight className="text-slate-400 transition group-hover:translate-x-1" /></div><h3 className="mt-5 font-bold">공지사항</h3><p className="mt-1 text-sm text-slate-500">조직 공지와 확인 여부를 조회합니다.</p></Card>
          </Link>
          <Link href={`/organizations/${organizationId}/calendar`} className="block">
            <Card className="group h-full"><div className="flex items-center justify-between"><span className="rounded-xl bg-emerald-50 p-3 text-emerald-600 dark:bg-emerald-950"><CalendarDays /></span><ArrowRight className="text-slate-400 transition group-hover:translate-x-1" /></div><h3 className="mt-5 font-bold">일정</h3><p className="mt-1 text-sm text-slate-500">조직 일정과 과제 마감을 달력으로 봅니다.</p></Card>
          </Link>
          <Link href={`/organizations/${organizationId}/questions`} className="block"><Card className="group h-full"><div className="flex items-center justify-between"><span className="rounded-xl bg-violet-50 p-3 text-violet-600 dark:bg-violet-950"><CircleHelp /></span><ArrowRight className="text-slate-400 transition group-hover:translate-x-1" /></div><h3 className="mt-5 font-bold">질문</h3><p className="mt-1 text-sm text-slate-500">전체·멘토·1:1 질문을 작성하고 답변합니다.</p></Card></Link>
          <Link href={`/organizations/${organizationId}/departments`} className="block"><Card className="group h-full"><div className="flex items-center justify-between"><span className="rounded-xl bg-blue-50 p-3 text-blue-600 dark:bg-blue-950"><MessageSquare /></span><ArrowRight className="text-slate-400 transition group-hover:translate-x-1" /></div><h3 className="mt-5 font-bold">부서와 채팅</h3><p className="mt-1 text-sm text-slate-500">소속 부서의 활동과 채팅을 확인합니다.</p></Card></Link>
        </div>
      </section>

      <section className="mt-10" aria-labelledby="organization-management-heading">
        <div>
          <h2 className="text-xl font-bold" id="organization-management-heading">조직 현황{canManage ? " 및 관리" : ""}</h2>
          <p className="mt-1 text-sm text-slate-500">구성원 수와 운영 정보를 확인합니다.</p>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Card><div className="flex items-center justify-between"><span className="rounded-xl bg-indigo-50 p-3 text-indigo-600 dark:bg-indigo-950"><Users /></span><span className="text-3xl font-black">{organization._count.members}</span></div><h3 className="mt-5 font-bold">활동 중인 구성원</h3><p className="mt-1 text-sm text-slate-500">현재 조직에 소속된 구성원 수입니다.</p></Card>
          {canManage && <Link href={`/organizations/${organizationId}/members`} className="block"><Card className="group h-full"><div className="flex items-center justify-between"><span className="rounded-xl bg-emerald-50 p-3 text-emerald-600 dark:bg-emerald-950"><Users /></span><ArrowRight className="text-slate-400 transition group-hover:translate-x-1" /></div><h3 className="mt-5 font-bold">구성원과 초대</h3><p className="mt-1 text-sm text-slate-500">초대 코드를 만들고 구성원 역할을 변경합니다.</p></Card></Link>}
          {canManage && <Link href={`/organizations/${organizationId}/statistics`} className="block"><Card className="group h-full"><div className="flex items-center justify-between"><span className="rounded-xl bg-cyan-50 p-3 text-cyan-600 dark:bg-cyan-950"><BarChart3 /></span><ArrowRight className="text-slate-400 transition group-hover:translate-x-1" /></div><h3 className="mt-5 font-bold">활동 통계</h3><p className="mt-1 text-sm text-slate-500">제출률·정답률·질문 응답 현황을 확인합니다.</p></Card></Link>}
          {canManage && <Link href={`/organizations/${organizationId}/integrations`} className="block"><Card className="group h-full"><div className="flex items-center justify-between"><span className="rounded-xl bg-fuchsia-50 p-3 text-fuchsia-600 dark:bg-fuchsia-950"><Settings /></span><ArrowRight className="text-slate-400 transition group-hover:translate-x-1" /></div><h3 className="mt-5 font-bold">외부 연동</h3><p className="mt-1 text-sm text-slate-500">Discord·이메일·외부 API 알림을 설정합니다.</p></Card></Link>}
        </div>
      </section>
    </div>
  );
}
