"use server";

import { MembershipRole, MembershipStatus, Prisma } from "@prisma/client";
import { addDays } from "./date";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAuthenticatedUser } from "@/features/auth/guards";
import { requireOrganizationAccess } from "./guards";
import { generateInvitationCode, hashInvitationCode } from "./invitation-code";
import {
  invitationSchema,
  joinOrganizationSchema,
  leaveOrganizationSchema,
  organizationSchema,
  organizationSettingsSchema,
  updateMemberRoleSchema,
} from "./schemas";
import { canLeaveOrganization } from "./permissions";
import { organizationLogoPath, removeOrganizationLogo, uploadOrganizationLogo, validateOrganizationLogo } from "./logo-storage";

export type InvitationActionState = {
  success: boolean;
  message?: string;
  invitationCode?: string;
};

export async function createOrganization(formData: FormData) {
  const user = await requireAuthenticatedUser();
  const parsed = organizationSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/organizations/new?error=invalid_input");

  let organizationId: string;
  try {
    organizationId = await prisma.$transaction(async (transaction) => {
      const created = await transaction.organization.create({
        data: { ...parsed.data, createdById: user.id },
      });
      await transaction.organizationMember.create({
        data: {
          organizationId: created.id,
          userId: user.id,
          role: MembershipRole.ORG_ADMIN,
        },
      });
      await transaction.auditLog.create({
        data: {
          actorId: user.id,
          organizationId: created.id,
          action: "ORGANIZATION_CREATED",
          targetType: "ORGANIZATION",
          targetId: created.id,
        },
      });
      return created.id;
    });
  } catch {
    redirect("/organizations/new?error=create_failed");
  }

  redirect(`/organizations/${organizationId}`);
}

export async function createInvitation(
  _previousState: InvitationActionState,
  formData: FormData,
): Promise<InvitationActionState> {
  const parsed = invitationSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { success: false, message: "초대 설정을 확인해 주세요." };

  const { user } = await requireOrganizationAccess(parsed.data.organizationId, true);
  const invitationCode = generateInvitationCode();
  try {
    await prisma.$transaction([
      prisma.organizationInvite.create({
        data: {
          organizationId: parsed.data.organizationId,
          codeHash: hashInvitationCode(invitationCode),
          role: parsed.data.role,
          maxUses: parsed.data.maxUses,
          expiresAt: addDays(new Date(), parsed.data.expiresInDays),
          createdById: user.id,
        },
      }),
      prisma.auditLog.create({
        data: {
          actorId: user.id,
          organizationId: parsed.data.organizationId,
          action: "INVITATION_CREATED",
          targetType: "ORGANIZATION_INVITE",
          metadata: {
            role: parsed.data.role,
            maxUses: parsed.data.maxUses,
            expiresInDays: parsed.data.expiresInDays,
          },
        },
      }),
    ]);
  } catch {
    return { success: false, message: "초대 코드를 발급할 수 없습니다. 잠시 후 다시 시도해 주세요." };
  }

  revalidatePath(`/organizations/${parsed.data.organizationId}/members`);
  return {
    success: true,
    message: "초대 코드는 다시 표시되지 않습니다. 안전하게 전달해 주세요.",
    invitationCode,
  };
}

export async function joinOrganization(formData: FormData) {
  const user = await requireAuthenticatedUser();
  const parsed = joinOrganizationSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/dashboard?error=invalid_invitation");

  const codeHash = hashInvitationCode(parsed.data.invitationCode);
  let organizationId: string;
  try {
    organizationId = await prisma.$transaction(
      async (transaction) => {
        const invitation = await transaction.organizationInvite.findUnique({
          where: { codeHash },
          include: { organization: { select: { archivedAt: true } } },
        });
        const now = new Date();
        const unavailable =
          !invitation ||
          invitation.organization.archivedAt !== null ||
          invitation.revokedAt !== null ||
          invitation.expiresAt <= now ||
          (invitation.maxUses !== null && invitation.usedCount >= invitation.maxUses);
        if (unavailable) throw new Error("INVITATION_UNAVAILABLE");

        const existing = await transaction.organizationMember.findUnique({
          where: {
            organizationId_userId: {
              organizationId: invitation.organizationId,
              userId: user.id,
            },
          },
        });
        if (existing?.status === MembershipStatus.ACTIVE) return invitation.organizationId;

        await transaction.organizationMember.upsert({
          where: {
            organizationId_userId: {
              organizationId: invitation.organizationId,
              userId: user.id,
            },
          },
          update: { role: invitation.role, status: MembershipStatus.ACTIVE },
          create: {
            organizationId: invitation.organizationId,
            userId: user.id,
            role: invitation.role,
          },
        });
        await transaction.organizationInvite.update({
          where: { id: invitation.id },
          data: { usedCount: { increment: 1 } },
        });
        await transaction.auditLog.create({
          data: {
            actorId: user.id,
            organizationId: invitation.organizationId,
            action: "ORGANIZATION_JOINED",
            targetType: "ORGANIZATION_MEMBER",
            targetId: user.id,
          },
        });
        return invitation.organizationId;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch {
    redirect("/dashboard?error=invitation_unavailable");
  }
  redirect(`/organizations/${organizationId}`);
}

export async function updateMemberRole(formData: FormData) {
  const parsed = updateMemberRoleSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/dashboard?error=invalid_input");
  const { user } = await requireOrganizationAccess(parsed.data.organizationId, true);

  try {
    await prisma.$transaction(
      async (transaction) => {
        const target = await transaction.organizationMember.findUnique({
          where: {
            organizationId_userId: {
              organizationId: parsed.data.organizationId,
              userId: parsed.data.memberId,
            },
          },
        });
        if (!target || target.status !== MembershipStatus.ACTIVE) {
          throw new Error("MEMBER_NOT_FOUND");
        }

        if (
          target.role === MembershipRole.ORG_ADMIN &&
          parsed.data.role !== MembershipRole.ORG_ADMIN
        ) {
          const adminCount = await transaction.organizationMember.count({
            where: {
              organizationId: parsed.data.organizationId,
              role: MembershipRole.ORG_ADMIN,
              status: MembershipStatus.ACTIVE,
            },
          });
          if (adminCount <= 1) throw new Error("LAST_ADMIN");
        }

        await transaction.organizationMember.update({
          where: {
            organizationId_userId: {
              organizationId: parsed.data.organizationId,
              userId: parsed.data.memberId,
            },
          },
          data: { role: parsed.data.role },
        });
        await transaction.auditLog.create({
          data: {
            actorId: user.id,
            organizationId: parsed.data.organizationId,
            action: "MEMBER_ROLE_UPDATED",
            targetType: "ORGANIZATION_MEMBER",
            targetId: parsed.data.memberId,
            metadata: { previousRole: target.role, role: parsed.data.role },
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch {
    redirect(`/organizations/${parsed.data.organizationId}/members?error=role_update_failed`);
  }

  revalidatePath(`/organizations/${parsed.data.organizationId}/members`);
  redirect(`/organizations/${parsed.data.organizationId}/members?message=role_updated`);
}

export async function updateOrganizationSettings(formData: FormData) {
  const parsed = organizationSettingsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/dashboard?error=invalid_input");
  const { user } = await requireOrganizationAccess(parsed.data.organizationId, true);

  let logo: Awaited<ReturnType<typeof validateOrganizationLogo>>;
  try {
    logo = await validateOrganizationLogo(formData.get("logo"));
    if (logo && parsed.data.removeLogo) throw new Error("CONFLICTING_LOGO_ACTION");
  } catch {
    redirect(`/organizations/${parsed.data.organizationId}/settings?error=invalid_logo`);
  }

  const current = await prisma.organization.findFirst({
    where: { id: parsed.data.organizationId, archivedAt: null },
    select: { logoStoragePath: true },
  });
  if (!current) redirect("/dashboard?error=organization_not_found");

  const newStoragePath = logo ? organizationLogoPath(parsed.data.organizationId, logo.extension) : null;
  if (logo && newStoragePath) {
    try {
      await uploadOrganizationLogo(newStoragePath, logo.file);
    } catch {
      redirect(`/organizations/${parsed.data.organizationId}/settings?error=upload_failed`);
    }
  }

  const logoChanged = Boolean(logo || parsed.data.removeLogo);
  try {
    await prisma.$transaction([
      prisma.organization.update({
        where: { id: parsed.data.organizationId },
        data: {
          name: parsed.data.name,
          description: parsed.data.description,
          ...(logo ? { logoStoragePath: newStoragePath, logoMimeType: logo.mimeType, logoUpdatedAt: new Date() } : {}),
          ...(parsed.data.removeLogo ? { logoStoragePath: null, logoMimeType: null, logoUpdatedAt: null } : {}),
        },
      }),
      prisma.auditLog.create({
        data: {
          actorId: user.id,
          organizationId: parsed.data.organizationId,
          action: "ORGANIZATION_SETTINGS_UPDATED",
          targetType: "ORGANIZATION",
          targetId: parsed.data.organizationId,
          metadata: { logoChanged },
        },
      }),
    ]);
  } catch {
    if (newStoragePath) await removeOrganizationLogo(newStoragePath).catch(() => undefined);
    redirect(`/organizations/${parsed.data.organizationId}/settings?error=update_failed`);
  }

  if (logoChanged && current.logoStoragePath && current.logoStoragePath !== newStoragePath) {
    await removeOrganizationLogo(current.logoStoragePath).catch(() => undefined);
  }
  revalidatePath(`/organizations/${parsed.data.organizationId}`);
  revalidatePath(`/organizations/${parsed.data.organizationId}/settings`);
  revalidatePath("/", "layout");
  redirect(`/organizations/${parsed.data.organizationId}/settings?message=updated`);
}

export async function leaveOrganization(formData: FormData) {
  const user = await requireAuthenticatedUser();
  const parsed = leaveOrganizationSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/profile?error=invalid_leave_request#organizations");

  try {
    await prisma.$transaction(async (transaction) => {
      const membership = await transaction.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId: parsed.data.organizationId,
            userId: user.id,
          },
        },
        include: { organization: { select: { name: true, archivedAt: true } } },
      });
      if (!membership || membership.status !== MembershipStatus.ACTIVE || membership.organization.archivedAt) {
        throw new Error("MEMBERSHIP_NOT_FOUND");
      }
      if (membership.organization.name !== parsed.data.confirmationName) {
        throw new Error("CONFIRMATION_MISMATCH");
      }

      const activeAdministratorCount = membership.role === MembershipRole.ORG_ADMIN
        ? await transaction.organizationMember.count({
            where: {
              organizationId: parsed.data.organizationId,
              role: MembershipRole.ORG_ADMIN,
              status: MembershipStatus.ACTIVE,
            },
          })
        : 0;
      if (!canLeaveOrganization(membership.role, activeAdministratorCount)) {
        throw new Error("LAST_ADMIN");
      }

      const now = new Date();
      await transaction.departmentMember.deleteMany({
        where: { userId: user.id, department: { organizationId: parsed.data.organizationId } },
      });
      await transaction.mentorRelation.updateMany({
        where: {
          organizationId: parsed.data.organizationId,
          endedAt: null,
          OR: [{ mentorId: user.id }, { menteeId: user.id }],
        },
        data: { endedAt: now },
      });
      await transaction.organizationMember.update({
        where: {
          organizationId_userId: {
            organizationId: parsed.data.organizationId,
            userId: user.id,
          },
        },
        data: { status: MembershipStatus.INACTIVE },
      });
      await transaction.auditLog.create({
        data: {
          actorId: user.id,
          organizationId: parsed.data.organizationId,
          action: "ORGANIZATION_LEFT",
          targetType: "ORGANIZATION_MEMBER",
          targetId: user.id,
          metadata: { previousRole: membership.role },
        },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "";
    if (reason === "LAST_ADMIN") redirect("/profile?error=last_organization_admin#organizations");
    if (reason === "CONFIRMATION_MISMATCH") redirect("/profile?error=organization_name_mismatch#organizations");
    redirect("/profile?error=leave_failed#organizations");
  }

  revalidatePath("/", "layout");
  redirect("/profile?message=organization_left#organizations");
}
