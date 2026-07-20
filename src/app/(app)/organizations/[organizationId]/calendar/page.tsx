import { CalendarEventType } from "@prisma/client";
import { ArrowRight, CalendarDays, ChevronLeft, ChevronRight, Pencil } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createCalendarEvent } from "@/features/calendar/actions";
import { adjacentCalendarMonth, parseCalendarMonth } from "@/features/calendar/date";
import { requireOrganizationAccess } from "@/features/organization/guards";
import { canManageOrganization } from "@/features/organization/permissions";
import { formatKoreanDateTime, formatKoreanDateTimeInput } from "@/lib/date";
import { prisma } from "@/lib/prisma";

const TYPE_LABELS: Record<CalendarEventType, string> = { CLASS: "수업", MEETING: "회의", EVENT: "행사" };
const dayKey = (date: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);

export default async function CalendarPage({ params, searchParams }: { params: Promise<{ organizationId: string }>; searchParams: Promise<{ month?: string; error?: string; message?: string }> }) {
  const { organizationId } = await params;
  const query = await searchParams;
  const month = parseCalendarMonth(query.month);
  if (!month) notFound();
  const { user, membership } = await requireOrganizationAccess(organizationId);
  const canManage = canManageOrganization({ systemRole: user.systemRole, membership });
  const [events, assignments] = await Promise.all([
    prisma.calendarEvent.findMany({ where: { organizationId, archivedAt: null, startsAt: { lt: month.end }, endsAt: { gte: month.start } }, orderBy: { startsAt: "asc" } }),
    prisma.assignment.findMany({ where: { organizationId, archivedAt: null, deadline: { gte: month.start, lt: month.end }, ...(canManage ? {} : { opensAt: { lte: new Date() }, OR: [{ audience: "ALL_MEMBERS" }, { targets: { some: { userId: user.id } } }] }) }, select: { id: true, title: true, deadline: true }, orderBy: { deadline: "asc" } }),
  ]);
  const entries = [
    ...events.map((event) => ({ key: `event-${event.id}`, date: event.startsAt, title: event.title, label: TYPE_LABELS[event.type], href: `/organizations/${organizationId}/calendar/${event.id}${canManage ? "/edit" : ""}`, editable: canManage })),
    ...assignments.map((assignment) => ({ key: `assignment-${assignment.id}`, date: assignment.deadline, title: assignment.title, label: "과제 마감", href: `/organizations/${organizationId}/assignments/${assignment.id}`, editable: false })),
  ].sort((a, b) => a.date.getTime() - b.date.getTime());
  const byDay = new Map<string, typeof entries>();
  for (const entry of entries) byDay.set(dayKey(entry.date), [...(byDay.get(dayKey(entry.date)) ?? []), entry]);
  const days = new Date(Date.UTC(month.year, month.month, 0)).getUTCDate();
  const leading = new Date(Date.UTC(month.year, month.month - 1, 1)).getUTCDay();
  const defaultStart = new Date(month.start.getTime() + 9 * 60 * 60 * 1000);
  const defaultEnd = new Date(defaultStart.getTime() + 60 * 60 * 1000);

  return <div>
    <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-semibold text-indigo-600">조직 일정과 과제 마감</p><h1 className="mt-1 text-3xl font-bold">{month.year}년 {month.month}월 일정</h1></div><div className="flex gap-2"><Link className="rounded-xl border p-3" href={`?month=${adjacentCalendarMonth(month.year, month.month, -1)}`} aria-label="이전 달"><ChevronLeft /></Link><Link className="rounded-xl border p-3" href={`?month=${adjacentCalendarMonth(month.year, month.month, 1)}`} aria-label="다음 달"><ChevronRight /></Link></div></div>
    {(query.error || query.message) && <p role="status" className={`mt-4 rounded-xl p-3 text-sm ${query.error ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>{query.error ? "일정 입력과 권한을 확인해 주세요." : "일정 변경을 반영했습니다."}</p>}
    <Card className="mt-6 overflow-x-auto"><div className="grid min-w-[700px] grid-cols-7 gap-px overflow-hidden rounded-xl bg-slate-200 dark:bg-slate-700">{["일", "월", "화", "수", "목", "금", "토"].map((label) => <div key={label} className="bg-slate-50 p-2 text-center text-xs font-bold dark:bg-slate-800">{label}</div>)}{Array.from({ length: leading }, (_, index) => <div key={`blank-${index}`} className="min-h-28 bg-white dark:bg-slate-900" />)}{Array.from({ length: days }, (_, index) => { const day = index + 1; const key = `${month.key}-${String(day).padStart(2, "0")}`; return <div key={key} className="min-h-28 bg-white p-2 dark:bg-slate-900"><span className="text-xs font-bold">{day}</span><div className="mt-1 space-y-1">{(byDay.get(key) ?? []).map((entry) => <Link key={entry.key} href={entry.href} className="block truncate rounded bg-indigo-50 px-1.5 py-1 text-xs text-indigo-700 dark:bg-indigo-950 dark:text-indigo-200"><strong>{entry.label}</strong> {entry.title}</Link>)}</div></div>; })}</div></Card>
    <div className="mt-6 grid gap-6 lg:grid-cols-2"><section><h2 className="text-xl font-bold">이번 달 목록</h2><div className="mt-3 space-y-3">{entries.map((entry) => <Card key={entry.key}><div className="flex items-start justify-between gap-3"><div><span className="text-xs font-semibold text-indigo-600">{entry.label}</span><h3 className="mt-1 font-bold">{entry.title}</h3><p className="mt-1 text-sm text-slate-500">{formatKoreanDateTime(entry.date)}</p></div><Link href={entry.href} aria-label={entry.editable ? "일정 수정" : "상세 보기"}>{entry.editable ? <Pencil size={18} /> : <ArrowRight size={18} />}</Link></div></Card>)}{!entries.length && <Card className="text-center text-sm text-slate-500">등록된 일정이 없습니다.</Card>}</div></section>
    {canManage && <section><h2 className="text-xl font-bold">일정 등록</h2><Card className="mt-3"><form action={createCalendarEvent} className="space-y-4"><input type="hidden" name="organizationId" value={organizationId} /><label className="block text-sm font-medium">종류<select name="type" className="mt-2 min-h-11 w-full rounded-xl border bg-white px-3 dark:bg-slate-900">{Object.values(CalendarEventType).map((type) => <option key={type} value={type}>{TYPE_LABELS[type]}</option>)}</select></label><label className="block text-sm font-medium">제목<Input name="title" required maxLength={100} className="mt-2" /></label><label className="block text-sm font-medium">설명<textarea name="description" maxLength={1000} rows={4} className="mt-2 w-full rounded-xl border p-3 dark:bg-slate-900" /></label><div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-medium">시작<Input type="datetime-local" name="startsAt" required defaultValue={formatKoreanDateTimeInput(defaultStart)} className="mt-2" /></label><label className="text-sm font-medium">종료<Input type="datetime-local" name="endsAt" required defaultValue={formatKoreanDateTimeInput(defaultEnd)} className="mt-2" /></label></div><Button type="submit" className="gap-2"><CalendarDays size={18} /> 등록</Button></form></Card></section>}</div>
  </div>;
}
