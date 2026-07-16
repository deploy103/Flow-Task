import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAuthenticatedUser } from "@/features/auth/guards";
import { canManageOrganization, canViewOrganization } from "./permissions";

export async function requireOrganizationAccess(organizationId: string, manage = false) {
  const user = await requireAuthenticatedUser();
  const membership = await prisma.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId, userId: user.id } },
  });
  const allowed = manage
    ? canManageOrganization({ systemRole: user.systemRole, membership })
    : canViewOrganization({ systemRole: user.systemRole, membership });

  if (!allowed) notFound();
  return { user, membership };
}
