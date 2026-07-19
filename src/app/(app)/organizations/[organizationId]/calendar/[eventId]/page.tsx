import { CalendarEventType } from "@prisma/client";
import { Pencil } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { requireOrganizationAccess } from "@/features/organization/guards";
import { canManageOrganization } from "@/features/organization/permissions";
import { formatKoreanDateTime } from "@/lib/date";
import { prisma } from "@/lib/prisma";

const labels: Record<CalendarEventType, string> = { CLASS: "수업", MEETING: "회의", EVENT: "행사" };

export default async function CalendarEventPage({ params }: { params: Promise<{ organizationId: string; eventId: string }> }) {
  const { organizationId, eventId } = await params;
  const { user, membership } = await requireOrganizationAccess(organizationId);
  const event = await prisma.calendarEvent.findFirst({ where: { id: eventId, organizationId, archivedAt: null } });
  if (!event) notFound();
  const canManage = canManageOrganization({ systemRole: user.systemRole, membership });
  return <div className="max-w-2xl"><p className="text-sm font-semibold text-indigo-600">{labels[event.type]}</p><div className="mt-1 flex items-start justify-between gap-4"><h1 className="text-3xl font-bold">{event.title}</h1>{canManage && <Link href={`/organizations/${organizationId}/calendar/${eventId}/edit`} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-indigo-600 px-4 font-semibold text-white"><Pencil size={18} /> 수정</Link>}</div><Card className="mt-6"><dl className="grid gap-4 sm:grid-cols-2"><div><dt className="text-xs font-semibold text-slate-500">시작</dt><dd className="mt-1 font-medium">{formatKoreanDateTime(event.startsAt)}</dd></div><div><dt className="text-xs font-semibold text-slate-500">종료</dt><dd className="mt-1 font-medium">{formatKoreanDateTime(event.endsAt)}</dd></div></dl>{event.description && <p className="mt-6 whitespace-pre-wrap border-t pt-6 text-sm leading-7 text-slate-700 dark:text-slate-200">{event.description}</p>}</Card></div>;
}
