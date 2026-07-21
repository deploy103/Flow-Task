import { AppShell } from "@/components/layout/app-shell";
import { requireAuthenticatedUser } from "@/features/auth/guards";
import { MembershipStatus, SystemRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { syncAssignmentNotifications } from "@/features/notification/queries";
import { queueNotificationDeliveries } from "@/features/notification/delivery";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAuthenticatedUser();
  await syncAssignmentNotifications(user.id);
  await queueNotificationDeliveries(user.id);
  const unreadNotifications = await prisma.notification.count({
    where: { userId: user.id, readAt: null },
  });
  const organizations =
    user.systemRole === SystemRole.SYSTEM_ADMIN
      ? await prisma.organization.findMany({
          where: { archivedAt: null },
          select: { id: true, name: true },
          orderBy: { createdAt: "asc" },
        })
      : (
          await prisma.organizationMember.findMany({
            where: { userId: user.id, status: MembershipStatus.ACTIVE },
            select: { organization: { select: { id: true, name: true } } },
            orderBy: { joinedAt: "asc" },
          })
        ).map(({ organization }) => organization);
  return (
    <AppShell
      userName={user.name}
      organizations={organizations}
      unreadNotifications={unreadNotifications}
      isSystemAdmin={user.systemRole === SystemRole.SYSTEM_ADMIN}
    >
      {children}
    </AppShell>
  );
}
