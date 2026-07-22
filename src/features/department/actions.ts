"use server";

import { DepartmentRole, MembershipStatus, Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireOrganizationAccess } from "@/features/organization/guards";
import { createDepartmentSchema, departmentMemberSchema, departmentMessageSchema, updateDepartmentSchema } from "./schemas";
import { requireDepartmentAccess } from "./guards";
import { canAccessDepartment } from "./policy";
import { MAX_DEPARTMENT_MESSAGES_PER_MINUTE } from "@/constants/department";

export async function createDepartment(formData: FormData) {
  const parsed = createDepartmentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/dashboard?error=invalid_input");
  const { user } = await requireOrganizationAccess(parsed.data.organizationId, true);
  try {
    await prisma.$transaction(async (transaction) => {
      const department = await transaction.department.create({
        data: { organizationId: parsed.data.organizationId, name: parsed.data.name, description: parsed.data.description, createdById: user.id },
      });
      await transaction.auditLog.create({ data: { actorId: user.id, organizationId: parsed.data.organizationId, action: "DEPARTMENT_CREATED", targetType: "DEPARTMENT", targetId: department.id } });
    });
  } catch {
    redirect(`/organizations/${parsed.data.organizationId}/departments?error=create_failed`);
  }
  revalidatePath(`/organizations/${parsed.data.organizationId}/departments`);
  redirect(`/organizations/${parsed.data.organizationId}/departments?message=created`);
}

export async function updateDepartment(formData: FormData) {
  const parsed = updateDepartmentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/dashboard?error=invalid_input");
  const { user } = await requireOrganizationAccess(parsed.data.organizationId, true);
  try {
    await prisma.$transaction(async (transaction) => {
      const updated = await transaction.department.updateMany({
        where: { id: parsed.data.departmentId, organizationId: parsed.data.organizationId, archivedAt: null },
        data: { name: parsed.data.name, description: parsed.data.description },
      });
      if (updated.count !== 1) throw new Error("DEPARTMENT_NOT_FOUND");
      await transaction.auditLog.create({
        data: { actorId: user.id, organizationId: parsed.data.organizationId, action: "DEPARTMENT_UPDATED", targetType: "DEPARTMENT", targetId: parsed.data.departmentId },
      });
    });
  } catch {
    redirect(`/organizations/${parsed.data.organizationId}/departments/${parsed.data.departmentId}?error=department_update_failed`);
  }
  revalidatePath(`/organizations/${parsed.data.organizationId}/departments`);
  revalidatePath(`/organizations/${parsed.data.organizationId}/departments/${parsed.data.departmentId}`);
  redirect(`/organizations/${parsed.data.organizationId}/departments/${parsed.data.departmentId}?message=department_updated`);
}

export async function updateDepartmentMembers(formData: FormData) {
  const parsed = departmentMemberSchema.safeParse({ ...Object.fromEntries(formData), memberIds: formData.getAll("memberIds") });
  if (!parsed.success) redirect("/dashboard?error=invalid_input");
  const { user } = await requireOrganizationAccess(parsed.data.organizationId, true);
  const targetIds = [...new Set([...parsed.data.memberIds, ...(parsed.data.leaderId ? [parsed.data.leaderId] : [])])];

  try {
    await prisma.$transaction(async (transaction) => {
      const department = await transaction.department.findFirst({ where: { id: parsed.data.departmentId, organizationId: parsed.data.organizationId, archivedAt: null }, select: { id: true } });
      if (!department) throw new Error("DEPARTMENT_NOT_FOUND");
      const activeCount = await transaction.organizationMember.count({ where: { organizationId: parsed.data.organizationId, userId: { in: targetIds }, status: MembershipStatus.ACTIVE } });
      if (activeCount !== targetIds.length) throw new Error("INVALID_MEMBERS");

      await transaction.departmentMember.updateMany({ where: { departmentId: parsed.data.departmentId, role: DepartmentRole.LEAD }, data: { role: DepartmentRole.MEMBER } });
      await transaction.departmentMember.deleteMany({ where: { departmentId: parsed.data.departmentId, userId: { notIn: targetIds } } });
      for (const userId of targetIds) {
        await transaction.departmentMember.upsert({
          where: { departmentId_userId: { departmentId: parsed.data.departmentId, userId } },
          create: { departmentId: parsed.data.departmentId, userId, role: userId === parsed.data.leaderId ? DepartmentRole.LEAD : DepartmentRole.MEMBER },
          update: { role: userId === parsed.data.leaderId ? DepartmentRole.LEAD : DepartmentRole.MEMBER },
        });
      }
      await transaction.auditLog.create({ data: { actorId: user.id, organizationId: parsed.data.organizationId, action: "DEPARTMENT_MEMBERS_UPDATED", targetType: "DEPARTMENT", targetId: parsed.data.departmentId, metadata: { memberCount: targetIds.length, hasLeader: Boolean(parsed.data.leaderId) } } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch {
    redirect(`/organizations/${parsed.data.organizationId}/departments/${parsed.data.departmentId}?error=member_update_failed`);
  }
  revalidatePath(`/organizations/${parsed.data.organizationId}/departments/${parsed.data.departmentId}`);
  redirect(`/organizations/${parsed.data.organizationId}/departments/${parsed.data.departmentId}?message=members_updated`);
}

export async function sendDepartmentMessage(formData: FormData) {
  const parsed = departmentMessageSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/dashboard?error=invalid_input");
  const { user } = await requireDepartmentAccess(parsed.data.organizationId, parsed.data.departmentId);
  try {
    await prisma.$transaction(async (transaction) => {
      const [membership, department] = await Promise.all([
        transaction.organizationMember.findUnique({ where: { organizationId_userId: { organizationId: parsed.data.organizationId, userId: user.id } } }),
        transaction.department.findFirst({ where: { id: parsed.data.departmentId, organizationId: parsed.data.organizationId, archivedAt: null }, include: { members: { where: { userId: user.id }, select: { userId: true } } } }),
      ]);
      if (!department || !canAccessDepartment({ systemRole: user.systemRole, organizationRole: membership?.role, organizationStatus: membership?.status, isDepartmentMember: department.members.length > 0 })) throw new Error("FORBIDDEN");
      const recentMessages = await transaction.departmentMessage.count({ where: { departmentId: parsed.data.departmentId, authorId: user.id, createdAt: { gte: new Date(Date.now() - 60_000) } } });
      if (recentMessages >= MAX_DEPARTMENT_MESSAGES_PER_MINUTE) throw new Error("RATE_LIMITED");
      const message = await transaction.departmentMessage.create({ data: { departmentId: parsed.data.departmentId, authorId: user.id, content: parsed.data.content } });
      await transaction.auditLog.create({ data: { actorId: user.id, organizationId: parsed.data.organizationId, action: "DEPARTMENT_MESSAGE_CREATED", targetType: "DEPARTMENT_MESSAGE", targetId: message.id } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch {
    redirect(`/organizations/${parsed.data.organizationId}/departments/${parsed.data.departmentId}?error=message_failed`);
  }
  revalidatePath(`/organizations/${parsed.data.organizationId}/departments/${parsed.data.departmentId}`);
  redirect(`/organizations/${parsed.data.organizationId}/departments/${parsed.data.departmentId}?message=sent`);
}
