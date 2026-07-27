import { Search, Trash2, UserCog } from "lucide-react";
import { SystemRole } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { deleteUserAsSystemAdmin, updateUserAsSystemAdmin } from "@/features/admin/actions";
import { requireSystemAdministrator } from "@/features/auth/guards";
import { formatDateOnly } from "@/features/auth/birth-date";
import { prisma } from "@/lib/prisma";

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<{ q?: string; error?: string; message?: string }> }) {
  const actor = await requireSystemAdministrator();
  const notice = await searchParams;
  const query = notice.q?.trim().slice(0, 100) ?? "";
  const users = await prisma.user.findMany({
    where: {
      email: { not: { endsWith: "@deleted.invalid" } },
      ...(query ? { OR: [{ name: { contains: query, mode: "insensitive" } }, { email: { contains: query, mode: "insensitive" } }, { studentNumber: { contains: query, mode: "insensitive" } }] } : {}),
    },
    include: { _count: { select: { memberships: true, submissions: true } } },
    orderBy: [{ systemRole: "desc" }, { createdAt: "desc" }],
    take: 100,
  });

  return <div><div className="flex items-start gap-3"><span className="rounded-xl bg-indigo-50 p-3 text-indigo-600 dark:bg-indigo-950"><UserCog /></span><div><h1 className="text-3xl font-black">사용자 관리</h1><p className="mt-2 text-sm text-slate-500">개인정보와 시스템 역할 변경, 로그인 폐기와 삭제 익명화를 관리합니다. 검색 결과는 최대 100명입니다.</p></div></div>
    <form className="mt-6 flex gap-2" method="get"><Input name="q" defaultValue={query} placeholder="이름, 이메일 또는 학번 검색"/><Button className="shrink-0 gap-2"><Search size={16}/> 검색</Button></form>
    {notice.error && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-700">요청을 처리하지 못했습니다. 입력값, 중복 이메일 또는 관리자 보호 조건을 확인해 주세요.</p>}
    {notice.message && <p role="status" className="mt-5 rounded-xl bg-green-50 p-3 text-sm text-green-700">{notice.message === "deleted" ? "사용자의 로그인 수단을 폐기하고 개인정보를 익명화했습니다." : "사용자 정보를 수정했습니다."}</p>}
    <div className="mt-5 space-y-4">{users.map((user) => <Card key={user.id}>
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-bold">{user.name}</h2><p className="text-sm text-slate-500">{user.email}</p><p className="mt-1 text-xs text-slate-500">동아리 기록 {user._count.memberships}개 · 제출 {user._count.submissions}개 · 가입 {user.createdAt.toLocaleDateString("ko-KR")}</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${user.systemRole === SystemRole.SYSTEM_ADMIN ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-600"}`}>{user.systemRole === SystemRole.SYSTEM_ADMIN ? "시스템 관리자" : "일반 사용자"}</span></div>
      <form action={updateUserAsSystemAdmin} className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><input type="hidden" name="userId" value={user.id}/><label className="text-sm font-medium">이름<Input name="name" defaultValue={user.name} required minLength={2} maxLength={50} className="mt-1"/></label><label className="text-sm font-medium">이메일<Input name="email" type="email" defaultValue={user.email} required maxLength={320} className="mt-1"/></label><label className="text-sm font-medium">학번<Input name="studentNumber" defaultValue={user.studentNumber ?? ""} maxLength={30} className="mt-1"/></label><label className="text-sm font-medium">생년월일<Input name="birthDate" type="date" defaultValue={user.birthDate ? formatDateOnly(user.birthDate) : ""} className="mt-1"/></label><label className="text-sm font-medium">시스템 역할<select name="systemRole" defaultValue={user.systemRole} className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-900"><option value="USER">일반 사용자</option><option value="SYSTEM_ADMIN">시스템 관리자</option></select></label><Button type="submit" className="self-end">정보 저장</Button></form>
      {actor.id !== user.id && user.systemRole !== SystemRole.SYSTEM_ADMIN && <details className="mt-5 rounded-xl border border-red-200 p-4 dark:border-red-900"><summary className="cursor-pointer text-sm font-bold text-red-700 dark:text-red-300">사용자 삭제</summary><p className="mt-3 text-xs leading-5 text-slate-500">로그인 수단과 활성 소속을 폐기하고 이름·이메일·생년월일·학번을 익명화합니다. 제출·감사 기록은 익명 사용자로 보존됩니다.</p><form action={deleteUserAsSystemAdmin} className="mt-3 flex flex-col gap-2 sm:flex-row"><input type="hidden" name="userId" value={user.id}/><Input name="confirmationEmail" type="email" required placeholder={`확인: ${user.email}`} aria-label={`${user.email} 삭제 확인 이메일`}/><Button type="submit" className="shrink-0 gap-2 bg-red-600 hover:bg-red-700"><Trash2 size={16}/> 삭제</Button></form></details>}
    </Card>)}{!users.length && <Card><p className="text-center text-sm text-slate-500">검색된 사용자가 없습니다.</p></Card>}</div>
  </div>;
}
