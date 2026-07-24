import Link from "next/link";
import { ArrowRight, Building2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { deleteOrganizationAsSystemAdmin, updateOrganizationAsSystemAdmin } from "@/features/admin/actions";
import { requireSystemAdministrator } from "@/features/auth/guards";
import { prisma } from "@/lib/prisma";

export default async function AdminOrganizationsPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string }> }) {
  await requireSystemAdministrator();
  const notice = await searchParams;
  const organizations = await prisma.organization.findMany({
    where: { archivedAt: null },
    include: {
      createdBy: { select: { name: true, email: true } },
      _count: { select: { members: { where: { status: "ACTIVE" } }, assignments: true, announcements: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return <div><div className="flex items-start gap-3"><span className="rounded-xl bg-indigo-50 p-3 text-indigo-600 dark:bg-indigo-950"><Building2 /></span><div><h1 className="text-3xl font-black">전체 동아리 관리</h1><p className="mt-2 text-sm text-slate-500">시스템 관리자는 소속 여부와 관계없이 모든 동아리를 열고 설정을 관리할 수 있습니다.</p></div></div>
    {notice.error && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-700">요청을 처리하지 못했습니다. 입력값과 확인 문구를 점검해 주세요.</p>}
    {notice.message && <p role="status" className="mt-5 rounded-xl bg-green-50 p-3 text-sm text-green-700">{notice.message === "deleted" ? "동아리를 삭제 처리했습니다." : "동아리 정보를 수정했습니다."}</p>}
    <p className="mt-6 text-sm font-semibold">활성 동아리 {organizations.length.toLocaleString("ko-KR")}개</p>
    <div className="mt-4 space-y-4">{organizations.map((organization) => <Card key={organization.id}>
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-bold">{organization.name}</h2><p className="mt-1 text-xs text-slate-500">생성자 {organization.createdBy.name} · {organization.createdBy.email}</p><p className="mt-1 text-xs text-slate-500">활성 구성원 {organization._count.members}명 · 과제 {organization._count.assignments}개 · 공지 {organization._count.announcements}개</p></div><Link href={`/organizations/${organization.id}`} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-indigo-600 px-3 text-sm font-semibold text-white">동아리 열기 <ArrowRight size={16}/></Link></div>
      <form action={updateOrganizationAsSystemAdmin} className="mt-5 grid gap-3 lg:grid-cols-[minmax(12rem,0.7fr)_minmax(18rem,1.3fr)_auto]"><input type="hidden" name="organizationId" value={organization.id}/><label className="text-sm font-medium">이름<Input name="name" defaultValue={organization.name} required minLength={2} maxLength={80} className="mt-1"/></label><label className="text-sm font-medium">설명<Input name="description" defaultValue={organization.description ?? ""} maxLength={500} className="mt-1"/></label><Button type="submit" className="self-end">정보 저장</Button></form>
      <details className="mt-5 rounded-xl border border-red-200 p-4 dark:border-red-900"><summary className="cursor-pointer text-sm font-bold text-red-700 dark:text-red-300">동아리 삭제</summary><p className="mt-3 text-xs leading-5 text-slate-500">참조 무결성과 감사 기록을 위해 데이터는 보관 상태로 전환합니다. 모든 구성원 접근과 초대는 즉시 해제됩니다.</p><form action={deleteOrganizationAsSystemAdmin} className="mt-3 flex flex-col gap-2 sm:flex-row"><input type="hidden" name="organizationId" value={organization.id}/><Input name="confirmationName" required placeholder={`확인: ${organization.name}`} aria-label={`${organization.name} 삭제 확인 이름`}/><Button type="submit" className="shrink-0 gap-2 bg-red-600 hover:bg-red-700"><Trash2 size={16}/> 삭제</Button></form></details>
    </Card>)}{!organizations.length && <Card><p className="text-center text-sm text-slate-500">활성 동아리가 없습니다.</p></Card>}</div>
  </div>;
}
