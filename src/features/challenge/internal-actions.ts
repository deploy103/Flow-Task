"use server";

import { AssignmentItemType, Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireOrganizationAccess } from "@/features/organization/guards";
import { canManageOrganization } from "@/features/organization/permissions";
import { prisma } from "@/lib/prisma";
import { hashChallengeFlag } from "./flag";
import { createInternalChallengeSchema, parseChallengeHints } from "./internal-schemas";
import {
  challengeResourcePath,
  removeChallengeResource,
  uploadChallengeResource,
  validateChallengeResource,
} from "./resource-storage";

function challengeRedirect(organizationId: string, assignmentId: string, error: string): never {
  redirect(`/organizations/${organizationId}/assignments/${assignmentId}/ctf/new?error=${error}`);
}

const internalChallengeContextSchema = z.object({
  organizationId: z.uuid(),
  assignmentId: z.uuid(),
});

export async function createInternalChallenge(formData: FormData) {
  const context = internalChallengeContextSchema.safeParse({
    organizationId: formData.get("organizationId"),
    assignmentId: formData.get("assignmentId"),
  });
  if (!context.success) redirect("/dashboard?challenge_error=invalid_input");
  const parsed = createInternalChallengeSchema.safeParse(Object.fromEntries(formData));
  const { organizationId, assignmentId } = context.data;
  if (!parsed.success) challengeRedirect(organizationId, assignmentId, "invalid_input");
  const { user } = await requireOrganizationAccess(organizationId, true);

  let resource;
  try {
    resource = await validateChallengeResource(formData.get("resource"));
  } catch {
    challengeRedirect(organizationId, assignmentId, "invalid_resource");
  }
  if (!resource) {
    challengeRedirect(organizationId, assignmentId, "resource_required");
  }

  let flagDigest: string;
  try {
    flagDigest = hashChallengeFlag(parsed.data.flag!, {
      caseSensitive: parsed.data.caseSensitive,
      trimWhitespace: parsed.data.trimWhitespace,
    });
  } catch {
    challengeRedirect(organizationId, assignmentId, "create_failed");
  }

  const storagePath = resource
    ? challengeResourcePath(organizationId, user.id, resource.metadata.extension)
    : null;
  if (resource && storagePath) {
    try {
      await uploadChallengeResource(storagePath, resource.file);
    } catch {
      challengeRedirect(organizationId, assignmentId, "upload_failed");
    }
  }

  let itemId: string;
  try {
    itemId = await prisma.$transaction(
      async (transaction) => {
        const membership = await transaction.organizationMember.findUnique({
          where: { organizationId_userId: { organizationId, userId: user.id } },
        });
        if (!canManageOrganization({ systemRole: user.systemRole, membership })) {
          throw new Error("FORBIDDEN");
        }
        const assignment = await transaction.assignment.findFirst({
          where: { id: assignmentId, organizationId, archivedAt: null },
          select: { id: true },
        });
        if (!assignment) throw new Error("ASSIGNMENT_NOT_FOUND");
        const maximum = await transaction.assignmentItem.aggregate({
          where: { assignmentId },
          _max: { position: true },
        });
        const position = (maximum._max.position ?? -1) + 1;
        if (position > 2_147_483_647) throw new Error("POSITION_UNAVAILABLE");
        const hints = parseChallengeHints(parsed.data.hints);
        const item = await transaction.assignmentItem.create({
          data: {
            assignmentId,
            type: AssignmentItemType.INTERNAL_CTF,
            position,
            internalChallenge: {
              create: {
                title: parsed.data.title,
                description: parsed.data.description,
                category: parsed.data.category,
                difficulty: parsed.data.difficulty,
                points: parsed.data.points,
                mode: parsed.data.mode,
                protocol: null,
                host: null,
                port: null,
                instanceTemplateRef: null,
                instanceCpuMilli: null,
                instanceMemoryMb: null,
                instanceLifetimeMinutes: null,
                hints: hints.length
                  ? { createMany: { data: hints.map((content, hintPosition) => ({ content, position: hintPosition })) } }
                  : undefined,
                resources: resource && storagePath
                  ? {
                      create: {
                        storagePath,
                        originalFilename: resource.metadata.originalFilename,
                        mimeType: resource.metadata.mimeType,
                        sizeBytes: resource.metadata.sizeBytes,
                      },
                    }
                  : undefined,
              },
            },
            challengeGrading: {
              create: {
                flagDigest,
                flagFormat: parsed.data.flagFormat ?? null,
                caseSensitive: parsed.data.caseSensitive,
                trimWhitespace: parsed.data.trimWhitespace,
                maxAttempts: parsed.data.maxAttempts ?? null,
                penaltyPerWrongAttempt: parsed.data.penaltyPerWrongAttempt,
              },
            },
          },
          select: { id: true },
        });
        await transaction.auditLog.create({
          data: {
            actorId: user.id,
            organizationId,
            action: "INTERNAL_CHALLENGE_CREATED",
            targetType: "ASSIGNMENT_ITEM",
            targetId: item.id,
            metadata: {
              assignmentId,
              mode: parsed.data.mode,
              category: parsed.data.category,
              points: parsed.data.points,
              hasResource: resource !== null,
              hintCount: hints.length,
            },
          },
        });
        return item.id;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (error) {
    if (storagePath) await removeChallengeResource(storagePath).catch(() => undefined);
    if (error instanceof Error && error.message === "FORBIDDEN") {
      challengeRedirect(organizationId, assignmentId, "forbidden");
    }
    challengeRedirect(organizationId, assignmentId, "create_failed");
  }
  redirect(`/organizations/${organizationId}/assignments/${assignmentId}?challenge_success=created&challenge_item=${itemId}`);
}
