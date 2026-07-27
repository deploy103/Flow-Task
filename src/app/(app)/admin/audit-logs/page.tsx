import { Prisma } from "@prisma/client";
import { ArrowLeft, ArrowRight, Building2, FileClock, Search, Users } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ADMIN_AUDIT_PAGE_SIZE, parseAdminAuditQuery } from "@/features/admin/audit-query";
import { requireSystemAdministrator } from "@/features/auth/guards";
import { prisma } from "@/lib/prisma";

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    dateStyle: "short",
    timeStyle: "medium",
  }).format(value);
}

function pageHref(query: ReturnType<typeof parseAdminAuditQuery>, page: number) {
  const parameters = new URLSearchParams();
  if (query.q) parameters.set("q", query.q);
  if (query.action) parameters.set("action", query.action);
  if (query.targetType) parameters.set("targetType", query.targetType);
  if (query.organizationId) parameters.set("organizationId", query.organizationId);
  parameters.set("page", String(page));
  return `/admin/audit-logs?${parameters.toString()}`;
}

export default async function AdminAuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireSystemAdministrator();
  const query = parseAdminAuditQuery(await searchParams);
  const where: Prisma.AuditLogWhereInput = {
    ...(query.action ? { action: query.action } : {}),
    ...(query.targetType ? { targetType: query.targetType } : {}),
    ...(query.organizationId ? { organizationId: query.organizationId } : {}),
    ...(query.q ? {
      OR: [
        { action: { contains: query.q, mode: "insensitive" } },
        { targetType: { contains: query.q, mode: "insensitive" } },
        { targetId: { contains: query.q, mode: "insensitive" } },
        { actor: { is: { OR: [{ name: { contains: query.q, mode: "insensitive" } }, { email: { contains: query.q, mode: "insensitive" } }] } } },
        { organization: { is: { name: { contains: query.q, mode: "insensitive" } } } },
      ],
    } : {}),
  };
  const [total, actions, targetTypes, organizations] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({ distinct: ["action"], orderBy: { action: "asc" }, select: { action: true }, take: 200 }),
    prisma.auditLog.findMany({ distinct: ["targetType"], orderBy: { targetType: "asc" }, select: { targetType: true }, take: 100 }),
    prisma.organization.findMany({ select: { id: true, name: true, archivedAt: true }, orderBy: { name: "asc" }, take: 500 }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / ADMIN_AUDIT_PAGE_SIZE));
  const currentPage = Math.min(query.page, totalPages);
  const logs = await prisma.auditLog.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: (currentPage - 1) * ADMIN_AUDIT_PAGE_SIZE,
    take: ADMIN_AUDIT_PAGE_SIZE,
    select: {
      id: true,
      action: true,
      targetType: true,
      targetId: true,
      organizationId: true,
      createdAt: true,
      actor: { select: { name: true, email: true } },
      organization: { select: { name: true } },
    },
  });

  return (
    <div>
      <div className="flex items-start gap-3">
        <span className="rounded-xl bg-indigo-50 p-3 text-indigo-600 dark:bg-indigo-950"><FileClock /></span>
        <div><h1 className="text-3xl font-black">전체 감사 로그</h1><p className="mt-2 text-sm text-slate-500">관리 변경 이력을 검색합니다. 비밀번호, 토큰, 제출 내용과 로그 metadata는 표시하지 않습니다.</p></div>
      </div>

      <Card className="mt-6">
        <form className="grid gap-3 lg:grid-cols-5" method="get">
          <label className="text-sm font-medium lg:col-span-2">검색<Input className="mt-1" defaultValue={query.q ?? ""} maxLength={100} name="q" placeholder="작업자, 작업, 대상 또는 조직" /></label>
          <label className="text-sm font-medium">작업<select className="mt-1 min-h-11 w-full rounded-xl border bg-white px-3 dark:bg-slate-900" defaultValue={query.action ?? ""} name="action"><option value="">모든 작업</option>{actions.map(({ action }) => <option key={action} value={action}>{action}</option>)}</select></label>
          <label className="text-sm font-medium">대상 종류<select className="mt-1 min-h-11 w-full rounded-xl border bg-white px-3 dark:bg-slate-900" defaultValue={query.targetType ?? ""} name="targetType"><option value="">모든 대상</option>{targetTypes.map(({ targetType }) => <option key={targetType} value={targetType}>{targetType}</option>)}</select></label>
          <label className="text-sm font-medium">조직<select className="mt-1 min-h-11 w-full rounded-xl border bg-white px-3 dark:bg-slate-900" defaultValue={query.organizationId ?? ""} name="organizationId"><option value="">모든 조직</option>{organizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name}{organization.archivedAt ? " (보관)" : ""}</option>)}</select></label>
          <div className="flex gap-2 lg:col-span-5"><Button className="gap-2" type="submit"><Search size={17} /> 조회</Button><Link className="inline-flex min-h-11 items-center rounded-xl border px-4 font-semibold" href="/admin/audit-logs">초기화</Link></div>
        </form>
      </Card>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3"><p className="text-sm font-semibold">검색 결과 {total.toLocaleString("ko-KR")}건</p><p className="text-xs text-slate-500">페이지당 최대 {ADMIN_AUDIT_PAGE_SIZE}건</p></div>
      <Card className="mt-3 overflow-x-auto p-0">
        <table className="min-w-[900px] text-left text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500 dark:bg-slate-950"><tr><th className="px-4 py-3">시각</th><th className="px-4 py-3">작업자</th><th className="px-4 py-3">작업</th><th className="px-4 py-3">대상</th><th className="px-4 py-3">조직</th><th className="px-4 py-3">이동</th></tr></thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {logs.map((log) => <tr key={log.id.toString()}><td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">{formatDateTime(log.createdAt)}</td><td className="px-4 py-3"><p className="font-semibold">{log.actor.name}</p><p className="text-xs text-slate-500">{log.actor.email}</p></td><td className="px-4 py-3 font-mono text-xs">{log.action}</td><td className="px-4 py-3"><p className="text-xs font-semibold">{log.targetType}</p>{log.targetId && <p className="mt-1 max-w-48 truncate font-mono text-xs text-slate-500" title={log.targetId}>{log.targetId}</p>}</td><td className="px-4 py-3 text-xs">{log.organization?.name ?? "시스템 전체"}</td><td className="px-4 py-3">{log.organizationId ? <Link aria-label={`${log.organization?.name ?? "조직"} 열기`} className="text-indigo-600" href={`/organizations/${log.organizationId}`}><Building2 size={18} /></Link> : log.targetType === "USER" ? <Link aria-label="사용자 관리 열기" className="text-indigo-600" href="/admin/users"><Users size={18} /></Link> : <span className="text-slate-300">-</span>}</td></tr>)}
          </tbody>
        </table>
        {!logs.length && <div className="p-10 text-center text-sm text-slate-500">조건에 맞는 감사 로그가 없습니다.</div>}
      </Card>

      <nav aria-label="감사 로그 페이지" className="mt-5 flex items-center justify-between gap-3">
        {currentPage > 1 ? <Link className="inline-flex min-h-11 items-center gap-2 rounded-xl border px-4 font-semibold" href={pageHref(query, currentPage - 1)}><ArrowLeft size={17} /> 이전</Link> : <span />}
        <span className="text-sm font-semibold">{currentPage.toLocaleString("ko-KR")} / {totalPages.toLocaleString("ko-KR")}</span>
        {currentPage < totalPages ? <Link className="inline-flex min-h-11 items-center gap-2 rounded-xl border px-4 font-semibold" href={pageHref(query, currentPage + 1)}>다음 <ArrowRight size={17} /></Link> : <span />}
      </nav>
    </div>
  );
}
