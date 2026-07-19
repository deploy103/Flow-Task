import { NotificationType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getDeadlineNotificationKind, isAssignmentNotificationPublished } from "./policy";

export async function syncAssignmentNotifications(userId: string, now = new Date()) {
  const assignments = await prisma.assignment.findMany({
    where: {
      archivedAt: null,
      organization: {
        members: { some: { userId, status: "ACTIVE" } },
      },
      OR: [
        { audience: "ALL_MEMBERS" },
        { targets: { some: { userId } } },
      ],
    },
    select: {
      id: true,
      organizationId: true,
      title: true,
      opensAt: true,
      deadline: true,
      submissions: { where: { userId }, select: { status: true }, take: 1 },
    },
  });

  const rows = assignments.flatMap((assignment) => {
    if (!isAssignmentNotificationPublished(assignment.opensAt, now)) return [];
    const href = `/organizations/${assignment.organizationId}/assignments/${assignment.id}`;
    const created = {
      userId,
      organizationId: assignment.organizationId,
      type: NotificationType.ASSIGNMENT_CREATED,
      title: "새 과제가 등록되었습니다",
      body: assignment.title,
      href,
      dedupeKey: `assignment:${assignment.id}:created`,
    };
    const kind = getDeadlineNotificationKind({
      now,
      opensAt: assignment.opensAt,
      deadline: assignment.deadline,
      submissionStatus: assignment.submissions[0]?.status,
    });
    if (!kind) return [created];
    const missing = kind === "MISSING_SUBMISSION";
    return [{
      userId,
      organizationId: assignment.organizationId,
      type: missing ? NotificationType.MISSING_SUBMISSION : NotificationType.DEADLINE_APPROACHING,
      title: missing ? "미제출 과제가 있습니다" : "과제 마감이 임박했습니다",
      body: assignment.title,
      href,
      dedupeKey: `assignment:${assignment.id}:${kind}`,
    }, created];
  });
  if (rows.length) await prisma.notification.createMany({ data: rows, skipDuplicates: true });
}
