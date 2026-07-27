"use server";

import { AnnouncementAudience, MembershipStatus, NotificationType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireOrganizationAccess } from "@/features/organization/guards";
import { canManageOrganization } from "@/features/organization/permissions";
import {
  announcementReferenceSchema,
  createAnnouncementSchema,
  recipientIdsSchema,
  updateAnnouncementSchema,
} from "./schemas";
import { canViewAnnouncement } from "./visibility";

export async function createAnnouncement(formData: FormData) {
  const parsed = createAnnouncementSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/dashboard?error=invalid_input");
  const { user } = await requireOrganizationAccess(parsed.data.organizationId, true);

  const parsedRecipients = recipientIdsSchema.safeParse([
    ...new Set(formData.getAll("recipientIds").filter((value): value is string => typeof value === "string")),
  ]);
  if (!parsedRecipients.success) redirect(`/organizations/${parsed.data.organizationId}/announcements/new?error=invalid_recipients`);
  const recipientIds = parsedRecipients.data;
  if (parsed.data.audience === AnnouncementAudience.SELECTED_MEMBERS && !recipientIds.length) {
    redirect(`/organizations/${parsed.data.organizationId}/announcements/new?error=recipient_required`);
  }

  if (parsed.data.audience === AnnouncementAudience.SELECTED_MEMBERS) {
    const activeRecipientCount = await prisma.organizationMember.count({
      where: {
        organizationId: parsed.data.organizationId,
        userId: { in: recipientIds },
        status: MembershipStatus.ACTIVE,
      },
    });
    if (activeRecipientCount !== recipientIds.length) {
      redirect(`/organizations/${parsed.data.organizationId}/announcements/new?error=invalid_recipients`);
    }
  }

  let announcementId: string;
  try {
    announcementId = await prisma.$transaction(async (transaction) => {
      const announcement = await transaction.announcement.create({
        data: {
          organizationId: parsed.data.organizationId,
          authorId: user.id,
          title: parsed.data.title,
          content: parsed.data.content,
          priority: parsed.data.priority,
          audience: parsed.data.audience,
          targets:
            parsed.data.audience === AnnouncementAudience.SELECTED_MEMBERS
              ? { createMany: { data: recipientIds.map((userId) => ({ userId })) } }
              : undefined,
        },
      });
      await transaction.auditLog.create({
        data: {
          actorId: user.id,
          organizationId: parsed.data.organizationId,
          action: "ANNOUNCEMENT_CREATED",
          targetType: "ANNOUNCEMENT",
          targetId: announcement.id,
          metadata: { priority: parsed.data.priority, audience: parsed.data.audience },
        },
      });
      const notificationUserIds = parsed.data.audience === AnnouncementAudience.SELECTED_MEMBERS
        ? recipientIds
        : (await transaction.organizationMember.findMany({
            where: { organizationId: parsed.data.organizationId, status: MembershipStatus.ACTIVE },
            select: { userId: true },
          })).map(({ userId }) => userId);
      if (notificationUserIds.length) {
        await transaction.notification.createMany({
          data: notificationUserIds.map((userId) => ({
            userId,
            organizationId: parsed.data.organizationId,
            type: NotificationType.ANNOUNCEMENT_CREATED,
            title: "새 공지가 등록되었습니다",
            body: parsed.data.title,
            href: `/organizations/${parsed.data.organizationId}/announcements/${announcement.id}`,
            dedupeKey: `announcement:${announcement.id}`,
          })),
          skipDuplicates: true,
        });
      }
      return announcement.id;
    });
  } catch {
    redirect(`/organizations/${parsed.data.organizationId}/announcements/new?error=create_failed`);
  }

  redirect(`/organizations/${parsed.data.organizationId}/announcements/${announcementId}`);
}

export async function confirmAnnouncement(formData: FormData) {
  const parsed = announcementReferenceSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/dashboard?error=invalid_input");
  const { user, membership } = await requireOrganizationAccess(parsed.data.organizationId);
  const announcement = await prisma.announcement.findFirst({
    where: {
      id: parsed.data.announcementId,
      organizationId: parsed.data.organizationId,
      archivedAt: null,
      publishedAt: { lte: new Date() },
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    select: { audience: true, targets: { select: { userId: true } } },
  });
  const canManage = canManageOrganization({ systemRole: user.systemRole, membership });
  if (
    !announcement ||
    !canViewAnnouncement({
      audience: announcement.audience,
      recipientIds: announcement.targets.map(({ userId }) => userId),
      userId: user.id,
      systemRole: user.systemRole,
      canManage,
    })
  ) {
    redirect(`/organizations/${parsed.data.organizationId}/announcements?error=not_found`);
  }

  await prisma.announcementRead.upsert({
    where: {
      announcementId_userId: {
        announcementId: parsed.data.announcementId,
        userId: user.id,
      },
    },
    update: {},
    create: { announcementId: parsed.data.announcementId, userId: user.id },
  });
  revalidatePath(`/organizations/${parsed.data.organizationId}/announcements/${parsed.data.announcementId}`);
  redirect(`/organizations/${parsed.data.organizationId}/announcements/${parsed.data.announcementId}?message=confirmed`);
}

export async function updateAnnouncement(formData: FormData) {
  const parsed = updateAnnouncementSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/dashboard?error=invalid_input");
  const { user } = await requireOrganizationAccess(parsed.data.organizationId, true);
  const parsedRecipients = recipientIdsSchema.safeParse([
    ...new Set(formData.getAll("recipientIds").filter((value): value is string => typeof value === "string")),
  ]);
  const editPath = `/organizations/${parsed.data.organizationId}/announcements/${parsed.data.announcementId}/edit`;
  if (!parsedRecipients.success) redirect(`${editPath}?error=invalid_recipients`);
  const recipientIds = parsedRecipients.data;
  if (parsed.data.audience === AnnouncementAudience.SELECTED_MEMBERS && recipientIds.length === 0) {
    redirect(`${editPath}?error=recipient_required`);
  }
  if (parsed.data.audience === AnnouncementAudience.SELECTED_MEMBERS) {
    const activeRecipientCount = await prisma.organizationMember.count({
      where: {
        organizationId: parsed.data.organizationId,
        userId: { in: recipientIds },
        status: MembershipStatus.ACTIVE,
      },
    });
    if (activeRecipientCount !== recipientIds.length) redirect(`${editPath}?error=invalid_recipients`);
  }

  const updated = await prisma.$transaction(async (transaction) => {
    const result = await transaction.announcement.updateMany({
      where: {
        id: parsed.data.announcementId,
        organizationId: parsed.data.organizationId,
        archivedAt: null,
      },
      data: {
        title: parsed.data.title,
        content: parsed.data.content,
        priority: parsed.data.priority,
        audience: parsed.data.audience,
      },
    });
    if (result.count !== 1) return false;
    await transaction.announcementTarget.deleteMany({ where: { announcementId: parsed.data.announcementId } });
    if (parsed.data.audience === AnnouncementAudience.SELECTED_MEMBERS) {
      await transaction.announcementTarget.createMany({
        data: recipientIds.map((userId) => ({ announcementId: parsed.data.announcementId, userId })),
      });
    }
    // A material edit invalidates previous acknowledgements; members must
    // explicitly confirm the current version of the notice.
    await transaction.announcementRead.deleteMany({ where: { announcementId: parsed.data.announcementId } });
    await transaction.auditLog.create({
      data: {
        actorId: user.id,
        organizationId: parsed.data.organizationId,
        action: "ANNOUNCEMENT_UPDATED",
        targetType: "ANNOUNCEMENT",
        targetId: parsed.data.announcementId,
        metadata: { priority: parsed.data.priority, audience: parsed.data.audience },
      },
    });
    return true;
  });
  if (!updated) redirect(`/organizations/${parsed.data.organizationId}/announcements?error=not_found`);
  redirect(`/organizations/${parsed.data.organizationId}/announcements/${parsed.data.announcementId}?message=updated`);
}

export async function archiveAnnouncement(formData: FormData) {
  const parsed = announcementReferenceSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/dashboard?error=invalid_input");
  const { user } = await requireOrganizationAccess(parsed.data.organizationId, true);
  const archived = await prisma.$transaction(async (transaction) => {
    const result = await transaction.announcement.updateMany({
      where: {
        id: parsed.data.announcementId,
        organizationId: parsed.data.organizationId,
        archivedAt: null,
      },
      data: { archivedAt: new Date() },
    });
    if (result.count !== 1) return false;
    await transaction.auditLog.create({
      data: {
        actorId: user.id,
        organizationId: parsed.data.organizationId,
        action: "ANNOUNCEMENT_ARCHIVED",
        targetType: "ANNOUNCEMENT",
        targetId: parsed.data.announcementId,
      },
    });
    return true;
  });
  if (!archived) redirect(`/organizations/${parsed.data.organizationId}/announcements?error=not_found`);
  redirect(`/organizations/${parsed.data.organizationId}/announcements?message=archived`);
}
