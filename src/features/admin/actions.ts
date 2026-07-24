"use server";

import { MembershipStatus, Prisma, SystemRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSystemAdministrator } from "@/features/auth/guards";
import { prisma } from "@/lib/prisma";
import { canChangeSystemRole, canDeleteManagedUser, deletedUserEmail, requiresEmailSecurityReset } from "./policy";
import {
  adminOrganizationDeleteSchema,
  adminOrganizationUpdateSchema,
  adminUserDeleteSchema,
  adminUserUpdateSchema,
} from "./schemas";

export async function updateUserAsSystemAdmin(formData: FormData) {
  const actor = await requireSystemAdministrator();
  const parsed = adminUserUpdateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/admin/users?error=invalid_input");

  try {
    await prisma.$transaction(async (transaction) => {
      const [target, administratorCount] = await Promise.all([
        transaction.user.findUnique({ where: { id: parsed.data.userId }, select: { id: true, email: true, systemRole: true } }),
        transaction.user.count({ where: { systemRole: SystemRole.SYSTEM_ADMIN } }),
      ]);
      if (!target || target.email.endsWith("@deleted.invalid")) throw new Error("USER_NOT_FOUND");
      if (!canChangeSystemRole({ actorId: actor.id, targetId: target.id, currentRole: target.systemRole, nextRole: parsed.data.systemRole, administratorCount })) {
        throw new Error("ADMIN_SAFETY_POLICY");
      }
      const emailChanged = requiresEmailSecurityReset(target.email, parsed.data.email);
      if (emailChanged) {
        await transaction.emailVerificationToken.deleteMany({ where: { userId: target.id } });
        await transaction.passwordResetToken.deleteMany({ where: { userId: target.id } });
        await transaction.authSession.deleteMany({ where: { userId: target.id } });
      }
      await transaction.user.update({
        where: { id: target.id },
        data: {
          name: parsed.data.name,
          email: parsed.data.email,
          studentNumber: parsed.data.studentNumber,
          birthDate: parsed.data.birthDate,
          systemRole: parsed.data.systemRole,
          ...(emailChanged ? { emailVerifiedAt: null } : {}),
        },
      });
      await transaction.auditLog.create({
        data: {
          actorId: actor.id,
          action: "SYSTEM_USER_UPDATED",
          targetType: "USER",
          targetId: target.id,
          metadata: { emailChanged, previousSystemRole: target.systemRole, systemRole: parsed.data.systemRole },
        },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch {
    redirect("/admin/users?error=update_failed");
  }

  revalidatePath("/admin/users");
  redirect("/admin/users?message=updated");
}

export async function deleteUserAsSystemAdmin(formData: FormData) {
  const actor = await requireSystemAdministrator();
  const parsed = adminUserDeleteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/admin/users?error=invalid_input");

  try {
    await prisma.$transaction(async (transaction) => {
      const target = await transaction.user.findUnique({ where: { id: parsed.data.userId }, select: { id: true, email: true, systemRole: true } });
      if (!target || target.email !== parsed.data.confirmationEmail || !canDeleteManagedUser(actor.id, target)) throw new Error("DELETE_DENIED");

      await transaction.organizationMember.updateMany({ where: { userId: target.id }, data: { status: MembershipStatus.INACTIVE } });
      await transaction.departmentMember.deleteMany({ where: { userId: target.id } });
      await transaction.authSession.deleteMany({ where: { userId: target.id } });
      await transaction.userCredential.deleteMany({ where: { userId: target.id } });
      await transaction.emailVerificationToken.deleteMany({ where: { userId: target.id } });
      await transaction.passwordResetToken.deleteMany({ where: { userId: target.id } });
      await transaction.webPushSubscription.deleteMany({ where: { userId: target.id } });
      await transaction.notificationPreference.deleteMany({ where: { userId: target.id } });
      await transaction.user.update({
        where: { id: target.id },
        data: {
          email: deletedUserEmail(target.id),
          name: "삭제된 사용자",
          studentNumber: null,
          birthDate: null,
          privacyConsentAt: null,
          privacyConsentVersion: null,
          emailVerifiedAt: null,
          systemRole: SystemRole.USER,
        },
      });
      await transaction.auditLog.create({
        data: { actorId: actor.id, action: "SYSTEM_USER_DELETED", targetType: "USER", targetId: target.id, metadata: { anonymized: true } },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch {
    redirect("/admin/users?error=delete_failed");
  }

  revalidatePath("/admin/users");
  revalidatePath("/admin");
  redirect("/admin/users?message=deleted");
}

export async function updateOrganizationAsSystemAdmin(formData: FormData) {
  const actor = await requireSystemAdministrator();
  const parsed = adminOrganizationUpdateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/admin/organizations?error=invalid_input");

  try {
    await prisma.$transaction([
      prisma.organization.update({ where: { id: parsed.data.organizationId, archivedAt: null }, data: { name: parsed.data.name, description: parsed.data.description } }),
      prisma.auditLog.create({ data: { actorId: actor.id, organizationId: parsed.data.organizationId, action: "SYSTEM_ORGANIZATION_UPDATED", targetType: "ORGANIZATION", targetId: parsed.data.organizationId } }),
    ]);
  } catch {
    redirect("/admin/organizations?error=update_failed");
  }
  revalidatePath("/admin/organizations");
  revalidatePath(`/organizations/${parsed.data.organizationId}`);
  redirect("/admin/organizations?message=updated");
}

export async function deleteOrganizationAsSystemAdmin(formData: FormData) {
  const actor = await requireSystemAdministrator();
  const parsed = adminOrganizationDeleteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/admin/organizations?error=invalid_input");

  try {
    await prisma.$transaction(async (transaction) => {
      const organization = await transaction.organization.findFirst({ where: { id: parsed.data.organizationId, archivedAt: null }, select: { id: true, name: true } });
      if (!organization || organization.name !== parsed.data.confirmationName) throw new Error("CONFIRMATION_MISMATCH");
      const now = new Date();
      await transaction.organization.update({ where: { id: organization.id }, data: { archivedAt: now } });
      await transaction.organizationMember.updateMany({ where: { organizationId: organization.id }, data: { status: MembershipStatus.INACTIVE } });
      await transaction.organizationInvite.updateMany({ where: { organizationId: organization.id, revokedAt: null }, data: { revokedAt: now } });
      await transaction.department.updateMany({ where: { organizationId: organization.id, archivedAt: null }, data: { archivedAt: now } });
      await transaction.auditLog.create({ data: { actorId: actor.id, organizationId: organization.id, action: "SYSTEM_ORGANIZATION_DELETED", targetType: "ORGANIZATION", targetId: organization.id, metadata: { archived: true } } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch {
    redirect("/admin/organizations?error=delete_failed");
  }
  revalidatePath("/admin/organizations");
  revalidatePath("/admin");
  redirect("/admin/organizations?message=deleted");
}
