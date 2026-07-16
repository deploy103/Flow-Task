import { AppShell } from "@/components/layout/app-shell";
import { requireAuthenticatedUser } from "@/features/auth/guards";
import { MembershipStatus, SystemRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAuthenticatedUser();
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
    <AppShell userName={user.name} organizations={organizations}>
      {children}
    </AppShell>
  );
}
