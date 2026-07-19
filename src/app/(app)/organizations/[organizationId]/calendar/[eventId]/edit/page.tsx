import { CalendarEventType } from "@prisma/client";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { archiveCalendarEvent, updateCalendarEvent } from "@/features/calendar/actions";
import { requireOrganizationAccess } from "@/features/organization/guards";
import { formatKoreanDateTimeInput } from "@/lib/date";
import { prisma } from "@/lib/prisma";

const labels: Record<CalendarEventType, string> = { CLASS: "수업", MEETING: "회의", EVENT: "행사" };

export default async function EditCalendarEventPage({ params }: { params: Promise<{ organizationId: string; eventId: string }> }) {
  const { organizationId, eventId } = await params;
  await requireOrganizationAccess(organizationId, true);
  const event = await prisma.calendarEvent.findFirst({ where: { id: eventId, organizationId, archivedAt: null } });
  if (!event) notFound();
  return <div className="max-w-2xl"><p className="text-sm font-semibold text-indigo-600">관리자 전용</p><h1 className="mt-1 text-3xl font-bold">일정 수정</h1><Card className="mt-6"><form action={updateCalendarEvent} className="space-y-4"><input type="hidden" name="organizationId" value={organizationId} /><input type="hidden" name="eventId" value={eventId} /><label className="block text-sm font-medium">종류<select name="type" defaultValue={event.type} className="mt-2 min-h-11 w-full rounded-xl border bg-white px-3 dark:bg-slate-900">{Object.values(CalendarEventType).map((type) => <option key={type} value={type}>{labels[type]}</option>)}</select></label><label className="block text-sm font-medium">제목<Input name="title" required maxLength={100} defaultValue={event.title} className="mt-2" /></label><label className="block text-sm font-medium">설명<textarea name="description" maxLength={1000} rows={5} defaultValue={event.description ?? ""} className="mt-2 w-full rounded-xl border p-3 dark:bg-slate-900" /></label><div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-medium">시작<Input type="datetime-local" name="startsAt" required defaultValue={formatKoreanDateTimeInput(event.startsAt)} className="mt-2" /></label><label className="text-sm font-medium">종료<Input type="datetime-local" name="endsAt" required defaultValue={formatKoreanDateTimeInput(event.endsAt)} className="mt-2" /></label></div><Button type="submit">수정 저장</Button></form><form action={archiveCalendarEvent} className="mt-4 border-t pt-4"><input type="hidden" name="organizationId" value={organizationId} /><input type="hidden" name="eventId" value={eventId} /><Button type="submit" className="bg-red-600 hover:bg-red-700">일정 보관</Button></form></Card></div>;
}
