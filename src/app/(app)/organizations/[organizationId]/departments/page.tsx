import { MessageSquare, Plus, Users } from "lucide-react";
import Link from "next/link";
import { BackLink } from "@/components/ui/back-link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createDepartment } from "@/features/department/actions";
import { requireOrganizationAccess } from "@/features/organization/guards";
import { canManageOrganization } from "@/features/organization/permissions";
import { prisma } from "@/lib/prisma";

export default async function DepartmentsPage({ params, searchParams }: { params: Promise<{ organizationId: string }>; searchParams: Promise<{ error?: string; message?: string }> }) {
  const { organizationId } = await params;
  const notice = await searchParams;
  const { user, membership } = await requireOrganizationAccess(organizationId);
  const canManage = canManageOrganization({ systemRole: user.systemRole, membership });
  const departments = await prisma.department.findMany({
    where: { organizationId, archivedAt: null, ...(canManage ? {} : { members: { some: { userId: user.id } } }) },
    include: { _count: { select: { members: true, messages: true } }, members: { where: { role: "LEAD" }, include: { user: { select: { name: true } } } } },
    orderBy: { name: "asc" },
  });
  return <div><BackLink href={`/organizations/${organizationId}`} label="조직 홈"/><div className="flex items-center gap-3"><MessageSquare className="text-indigo-600"/><h1 className="text-3xl font-bold">부서와 채팅</h1></div><p className="mt-2 text-slate-500">소속 부서의 구성원과 메시지를 나누세요.</p>
    {(notice.error || notice.message) && <p role="status" className={`mt-5 rounded-xl p-3 text-sm ${notice.error ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>{notice.error ? "부서를 만들 수 없습니다. 이름과 권한을 확인해 주세요." : "부서를 만들었습니다."}</p>}
    {canManage && <Card className="mt-6"><h2 className="flex items-center gap-2 text-lg font-bold"><Plus size={18}/> 부서 만들기</h2><form action={createDepartment} className="mt-4 grid gap-3 md:grid-cols-[1fr_2fr_auto]"><input type="hidden" name="organizationId" value={organizationId}/><Input name="name" required minLength={2} maxLength={80} placeholder="예: 기능부"/><Input name="description" maxLength={500} placeholder="부서가 하는 일을 설명하세요"/><Button>추가</Button></form></Card>}
    <div className="mt-6 grid gap-4 md:grid-cols-2">{departments.map((department) => <Link key={department.id} href={`/organizations/${organizationId}/departments/${department.id}`}><Card className="h-full"><div className="flex justify-between"><h2 className="text-lg font-bold">{department.name}</h2><Users className="text-indigo-600"/></div><p className="mt-2 text-sm text-slate-500">{department.description ?? "부서 설명이 없습니다."}</p><p className="mt-4 text-xs text-slate-500">부서장 {department.members[0]?.user.name ?? "미지정"} · {department._count.members}명 · 메시지 {department._count.messages}개</p></Card></Link>)}{departments.length === 0 && <Card><p className="text-sm text-slate-500">접근할 수 있는 부서가 없습니다.</p></Card>}</div>
  </div>;
}
