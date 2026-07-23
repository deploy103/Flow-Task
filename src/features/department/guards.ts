import { notFound } from "next/navigation";
import { requireAuthenticatedUser } from "@/features/auth/guards";
import { canAccessDepartment } from "./policy";
import { prisma } from "@/lib/prisma";

export async function requireDepartmentAccess(organizationId: string, departmentId: string) {
  const user = await requireAuthenticatedUser();
  const [membership, department] = await Promise.all([
    prisma.organizationMember.findUnique({ where: { organizationId_userId: { organizationId, userId: user.id } } }),
    prisma.department.findFirst({
      where: { id: departmentId, organizationId, archivedAt: null },
      include: { members: { where: { userId: user.id }, select: { userId: true } } },
    }),
  ]);
  if (!department || !canAccessDepartment({
    systemRole: user.systemRole,
    organizationRole: membership?.role,
    organizationStatus: membership?.status,
    isDepartmentMember: department.members.length > 0,
  })) notFound();
  return { user, membership, department };
}
