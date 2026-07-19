"use server";

import { redirect } from "next/navigation";
import { requireOrganizationAccess } from "@/features/organization/guards";
import { prisma } from "@/lib/prisma";
import { calendarEventReferenceSchema, calendarEventSchema } from "./schemas";

function calendarRedirect(organizationId: string, query: string): never {
  redirect(`/organizations/${organizationId}/calendar?${query}`);
}

export async function createCalendarEvent(formData: FormData) {
  const parsed = calendarEventSchema.safeParse(Object.fromEntries(formData));
  const organizationId = String(formData.get("organizationId") ?? "");
  if (!parsed.success) calendarRedirect(organizationId, "error=invalid_event");
  const { user } = await requireOrganizationAccess(parsed.data.organizationId, true);
  const event = await prisma.$transaction(async (transaction) => {
    const created = await transaction.calendarEvent.create({ data: {
      organizationId: parsed.data.organizationId, createdById: user.id, type: parsed.data.type,
      title: parsed.data.title, description: parsed.data.description || null,
      startsAt: parsed.data.startsAt, endsAt: parsed.data.endsAt,
    } });
    await transaction.auditLog.create({ data: { actorId: user.id, organizationId: parsed.data.organizationId, action: "CALENDAR_EVENT_CREATED", targetType: "CALENDAR_EVENT", targetId: created.id, metadata: { type: created.type } } });
    return created;
  });
  calendarRedirect(parsed.data.organizationId, `message=created&event=${event.id}`);
}

export async function updateCalendarEvent(formData: FormData) {
  const parsed = calendarEventSchema.safeParse(Object.fromEntries(formData));
  const organizationId = String(formData.get("organizationId") ?? "");
  if (!parsed.success || !parsed.data.eventId) calendarRedirect(organizationId, "error=invalid_event");
  const { user } = await requireOrganizationAccess(parsed.data.organizationId, true);
  const result = await prisma.$transaction(async (transaction) => {
    const updated = await transaction.calendarEvent.updateMany({ where: { id: parsed.data.eventId, organizationId: parsed.data.organizationId, archivedAt: null }, data: { type: parsed.data.type, title: parsed.data.title, description: parsed.data.description || null, startsAt: parsed.data.startsAt, endsAt: parsed.data.endsAt } });
    if (updated.count !== 1) return false;
    await transaction.auditLog.create({ data: { actorId: user.id, organizationId: parsed.data.organizationId, action: "CALENDAR_EVENT_UPDATED", targetType: "CALENDAR_EVENT", targetId: parsed.data.eventId } });
    return true;
  });
  if (!result) calendarRedirect(parsed.data.organizationId, "error=not_found");
  calendarRedirect(parsed.data.organizationId, "message=updated");
}

export async function archiveCalendarEvent(formData: FormData) {
  const parsed = calendarEventReferenceSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/dashboard?error=invalid_event");
  const { user } = await requireOrganizationAccess(parsed.data.organizationId, true);
  const result = await prisma.$transaction(async (transaction) => {
    const archived = await transaction.calendarEvent.updateMany({ where: { id: parsed.data.eventId, organizationId: parsed.data.organizationId, archivedAt: null }, data: { archivedAt: new Date() } });
    if (archived.count !== 1) return false;
    await transaction.auditLog.create({ data: { actorId: user.id, organizationId: parsed.data.organizationId, action: "CALENDAR_EVENT_ARCHIVED", targetType: "CALENDAR_EVENT", targetId: parsed.data.eventId } });
    return true;
  });
  if (!result) calendarRedirect(parsed.data.organizationId, "error=not_found");
  calendarRedirect(parsed.data.organizationId, "message=archived");
}
