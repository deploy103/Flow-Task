"use server";

import { AssignmentAudience, MembershipStatus } from "@prisma/client";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireOrganizationAccess } from "@/features/organization/guards";
import { ASSIGNMENT_FIELD_LABELS } from "@/constants/assignment";
import {
  assignmentFieldTypesSchema,
  assignmentOrganizationIdSchema,
  assignmentTargetIdsSchema,
  createAssignmentSchema,
} from "./schemas";
import { getAssignmentSetupPath } from "./setup";

export async function createAssignment(formData: FormData) {
  const parsedOrganizationId = assignmentOrganizationIdSchema.safeParse(
    formData.get("organizationId"),
  );
  if (!parsedOrganizationId.success) redirect("/dashboard?error=invalid_assignment");
  const parsed = createAssignmentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    redirect(`/organizations/${parsedOrganizationId.data}/assignments/new?error=invalid_input`);
  }
  const { user } = await requireOrganizationAccess(parsed.data.organizationId, true);

  const parsedTargetIds = assignmentTargetIdsSchema.safeParse([
    ...new Set(formData.getAll("targetUserIds").filter((value): value is string => typeof value === "string")),
  ]);
  if (!parsedTargetIds.success) {
    redirect(`/organizations/${parsed.data.organizationId}/assignments/new?error=invalid_targets`);
  }
  const targetUserIds = parsedTargetIds.data;
  const parsedFieldTypes = assignmentFieldTypesSchema.safeParse(formData.getAll("fieldTypes"));
  if (!parsedFieldTypes.success) {
    redirect(`/organizations/${parsed.data.organizationId}/assignments/new?error=invalid_fields`);
  }
  if (parsed.data.audience === AssignmentAudience.SELECTED_MEMBERS && !targetUserIds.length) {
    redirect(`/organizations/${parsed.data.organizationId}/assignments/new?error=target_required`);
  }

  if (parsed.data.audience === AssignmentAudience.SELECTED_MEMBERS) {
    const validTargetCount = await prisma.organizationMember.count({
      where: {
        organizationId: parsed.data.organizationId,
        userId: { in: targetUserIds },
        status: MembershipStatus.ACTIVE,
      },
    });
    if (validTargetCount !== targetUserIds.length) {
      redirect(`/organizations/${parsed.data.organizationId}/assignments/new?error=invalid_targets`);
    }
  }

  let assignmentId: string;
  try {
    assignmentId = await prisma.$transaction(async (transaction) => {
      const assignment = await transaction.assignment.create({
        data: {
          organizationId: parsed.data.organizationId,
          createdById: user.id,
          title: parsed.data.title,
          description: parsed.data.description,
          audience: parsed.data.audience,
          opensAt: parsed.data.opensAt,
          deadline: parsed.data.deadline,
          allowLate: parsed.data.allowLate,
          targets:
            parsed.data.audience === AssignmentAudience.SELECTED_MEMBERS
              ? { createMany: { data: targetUserIds.map((userId) => ({ userId })) } }
              : undefined,
          fields: parsedFieldTypes.data.length
            ? {
                createMany: {
                  data: parsedFieldTypes.data.map((type, position) => ({
                    type,
                    label: ASSIGNMENT_FIELD_LABELS[type],
                    required: true,
                    position,
                  })),
                },
              }
            : undefined,
        },
      });
      await transaction.auditLog.create({
        data: {
          actorId: user.id,
          organizationId: parsed.data.organizationId,
          action: "ASSIGNMENT_CREATED",
          targetType: "ASSIGNMENT",
          targetId: assignment.id,
          metadata: {
            audience: parsed.data.audience,
            opensAt: parsed.data.opensAt.toISOString(),
            deadline: parsed.data.deadline.toISOString(),
            allowLate: parsed.data.allowLate,
          },
        },
      });
      return assignment.id;
    });
  } catch {
    redirect(`/organizations/${parsed.data.organizationId}/assignments/new?error=create_failed`);
  }

  redirect(
    getAssignmentSetupPath(
      parsed.data.organizationId,
      assignmentId,
      parsed.data.setupType,
    ),
  );
}
