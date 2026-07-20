"use server";

import {
  AssignmentItemType,
  MembershipStatus,
  Prisma,
} from "@prisma/client";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireOrganizationAccess } from "@/features/organization/guards";
import { canManageOrganization } from "@/features/organization/permissions";
import { canSubmitAssignment } from "@/features/submission/access";
import { prisma } from "@/lib/prisma";
import { getChallengeAttemptAccess } from "./access";
import {
  getChallengeAccessError,
  hasChallengeSubmissionMethod,
  resolveChallengeSubmissionValues,
} from "./action-policy";
import { hashChallengeFlag, verifyChallengeFlag } from "./flag";
import { resolveChallengeAttempt } from "./grading";
import {
  createExternalChallengeSchema,
  submitExternalChallengeSchema,
} from "./schemas";

const challengeContextSchema = z.object({
  organizationId: z.uuid(),
  assignmentId: z.uuid(),
});

const moveExternalChallengeSchema = challengeContextSchema.extend({
  itemId: z.uuid(),
  direction: z.enum(["UP", "DOWN"]),
});

type ChallengeRedirectOptions =
  | { error: string; success?: never }
  | { error?: never; success: string };

function assignmentChallengeRedirect(
  organizationId: string,
  assignmentId: string,
  options: ChallengeRedirectOptions,
  itemId?: string,
): never {
  const searchParams = new URLSearchParams();
  if (options.error) searchParams.set("challenge_error", options.error);
  if (options.success) searchParams.set("challenge_success", options.success);
  if (itemId) searchParams.set("challenge_item", itemId);
  redirect(`/organizations/${organizationId}/assignments/${assignmentId}?${searchParams}`);
}

function challengeStatusRedirect(
  organizationId: string,
  assignmentId: string,
  options: ChallengeRedirectOptions,
  itemId?: string,
): never {
  const searchParams = new URLSearchParams();
  if (options.error) searchParams.set("challenge_error", options.error);
  if (options.success) searchParams.set("challenge_success", options.success);
  if (itemId) searchParams.set("challenge_item", itemId);
  redirect(
    `/organizations/${organizationId}/assignments/${assignmentId}/challenges?${searchParams}`,
  );
}

function parseChallengeContext(formData: FormData) {
  return challengeContextSchema.safeParse({
    organizationId: formData.get("organizationId"),
    assignmentId: formData.get("assignmentId"),
  });
}

export async function createExternalChallenge(formData: FormData) {
  const context = parseChallengeContext(formData);
  if (!context.success) redirect("/dashboard?challenge_error=invalid_input");

  const parsed = createExternalChallengeSchema.safeParse(Object.fromEntries(formData));
  const { organizationId, assignmentId } = context.data;
  if (!parsed.success) {
    assignmentChallengeRedirect(organizationId, assignmentId, { error: "invalid_input" });
  }
  if (!hasChallengeSubmissionMethod(parsed.data)) {
    assignmentChallengeRedirect(organizationId, assignmentId, {
      error: "submission_method_required",
    });
  }

  const { user } = await requireOrganizationAccess(organizationId, true);
  let flagDigest: string | null = null;
  try {
    flagDigest = parsed.data.flag
      ? hashChallengeFlag(parsed.data.flag, {
          caseSensitive: parsed.data.caseSensitive,
          trimWhitespace: parsed.data.trimWhitespace,
        })
      : null;
  } catch {
    assignmentChallengeRedirect(organizationId, assignmentId, { error: "create_failed" });
  }

  let result:
    | { status: "created"; itemId: string }
    | { status: "error"; error: "assignment_not_found" | "forbidden" | "position_unavailable" };
  try {
    result = await prisma.$transaction(
      async (transaction) => {
        const currentMembership = await transaction.organizationMember.findUnique({
          where: { organizationId_userId: { organizationId, userId: user.id } },
        });
        if (
          !canManageOrganization({
            systemRole: user.systemRole,
            membership: currentMembership,
          })
        ) {
          return { status: "error", error: "forbidden" } as const;
        }

        const assignment = await transaction.assignment.findFirst({
          where: { id: assignmentId, organizationId, archivedAt: null },
          select: { id: true },
        });
        if (!assignment) {
          return { status: "error", error: "assignment_not_found" } as const;
        }

        const positions = await transaction.assignmentItem.aggregate({
          where: { assignmentId },
          _max: { position: true },
        });
        const currentMaximumPosition = positions._max.position ?? -1;
        if (currentMaximumPosition >= 2_147_483_647) {
          return { status: "error", error: "position_unavailable" } as const;
        }

        const item = await transaction.assignmentItem.create({
          data: {
            assignmentId,
            type: AssignmentItemType.EXTERNAL_CHALLENGE,
            position: currentMaximumPosition + 1,
            externalChallenge: {
              create: {
                source: parsed.data.source,
                platform: parsed.data.platform,
                title: parsed.data.title,
                description: parsed.data.description,
                problemUrl: parsed.data.problemUrl,
                category: parsed.data.category,
                difficulty: parsed.data.difficulty,
                points: parsed.data.points,
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
                requireWriteup: parsed.data.requireWriteup,
                requireWriteupUrl: parsed.data.requireWriteupUrl,
              },
            },
          },
          select: { id: true },
        });

        await transaction.auditLog.create({
          data: {
            actorId: user.id,
            organizationId,
            action: "EXTERNAL_CHALLENGE_CREATED",
            targetType: "ASSIGNMENT_ITEM",
            targetId: item.id,
            metadata: {
              assignmentId,
              source: parsed.data.source,
              category: parsed.data.category,
              points: parsed.data.points,
              hasFlag: flagDigest !== null,
              requireWriteup: parsed.data.requireWriteup,
              requireWriteupUrl: parsed.data.requireWriteupUrl,
              maxAttempts: parsed.data.maxAttempts ?? null,
            },
          },
        });
        return { status: "created", itemId: item.id } as const;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch {
    assignmentChallengeRedirect(organizationId, assignmentId, { error: "create_failed" });
  }

  if (result.status === "error") {
    assignmentChallengeRedirect(organizationId, assignmentId, { error: result.error });
  }
  assignmentChallengeRedirect(
    organizationId,
    assignmentId,
    { success: "created" },
    result.itemId,
  );
}

export async function submitExternalChallenge(formData: FormData) {
  const context = parseChallengeContext(formData);
  if (!context.success) redirect("/dashboard?challenge_error=invalid_input");

  const parsed = submitExternalChallengeSchema.safeParse(Object.fromEntries(formData));
  const { organizationId, assignmentId } = context.data;
  if (!parsed.success) {
    assignmentChallengeRedirect(organizationId, assignmentId, { error: "invalid_input" });
  }

  const { user } = await requireOrganizationAccess(organizationId);
  let result:
    | { status: "completed"; itemId: string }
    | { status: "incorrect"; itemId: string }
    | { status: "error"; itemId: string; error: string };
  try {
    result = await prisma.$transaction(
      async (transaction) => {
        const item = await transaction.assignmentItem.findFirst({
          where: {
            id: parsed.data.itemId,
            assignmentId,
            type: AssignmentItemType.EXTERNAL_CHALLENGE,
            assignment: { organizationId, archivedAt: null },
          },
          select: {
            id: true,
            assignment: {
              select: {
                audience: true,
                opensAt: true,
                deadline: true,
                allowLate: true,
                targets: {
                  where: { userId: user.id },
                  select: { userId: true },
                },
              },
            },
            externalChallenge: { select: { points: true } },
            challengeGrading: {
              select: {
                flagDigest: true,
                caseSensitive: true,
                trimWhitespace: true,
                maxAttempts: true,
                penaltyPerWrongAttempt: true,
                requireWriteup: true,
                requireWriteupUrl: true,
              },
            },
          },
        });
        if (!item?.externalChallenge || !item.challengeGrading) {
          return { status: "error", itemId: parsed.data.itemId, error: "item_not_found" } as const;
        }

        const membership = await transaction.organizationMember.findFirst({
          where: {
            organizationId,
            userId: user.id,
            status: MembershipStatus.ACTIVE,
          },
          select: { status: true },
        });
        const existingSubmission = await transaction.challengeSubmission.findUnique({
          where: { itemId_userId: { itemId: item.id, userId: user.id } },
          select: {
            id: true,
            completedAt: true,
            writeup: true,
            writeupUrl: true,
          },
        });
        const attemptsCount = await transaction.challengeAttempt.count({
          where: { itemId: item.id, userId: user.id },
        });

        const canSubmit = canSubmitAssignment({
          audience: item.assignment.audience,
          targetUserIds: item.assignment.targets.map(({ userId }) => userId),
          userId: user.id,
          membershipStatus: membership?.status,
        });
        const now = new Date();
        const access = getChallengeAttemptAccess({
          canSubmit,
          opensAt: item.assignment.opensAt,
          deadline: item.assignment.deadline,
          allowLate: item.assignment.allowLate,
          completedAt: existingSubmission?.completedAt,
          attemptsCount,
          maxAttempts: item.challengeGrading.maxAttempts,
          now,
        });
        if (access !== "ALLOWED") {
          return {
            status: "error",
            itemId: item.id,
            error: getChallengeAccessError(access),
          } as const;
        }

        const requiresCorrectFlag = item.challengeGrading.flagDigest !== null;
        const submittedValues = resolveChallengeSubmissionValues({
          requiresCorrectFlag,
          requireWriteup: item.challengeGrading.requireWriteup,
          requireWriteupUrl: item.challengeGrading.requireWriteupUrl,
          submittedFlag: parsed.data.flag,
          submittedWriteup: parsed.data.writeup,
          submittedWriteupUrl: parsed.data.writeupUrl,
          existingWriteup: existingSubmission?.writeup,
          existingWriteupUrl: existingSubmission?.writeupUrl,
        });
        if (!submittedValues.success) {
          return {
            status: "error",
            itemId: item.id,
            error: submittedValues.error,
          } as const;
        }

        const flagCorrect = requiresCorrectFlag
          ? verifyChallengeFlag(
              submittedValues.data.flag ?? "",
              item.challengeGrading.flagDigest ?? "",
              {
                caseSensitive: item.challengeGrading.caseSensitive,
                trimWhitespace: item.challengeGrading.trimWhitespace,
              },
            )
          : true;
        const previousWrongAttempts = await transaction.challengeAttempt.count({
          where: { itemId: item.id, userId: user.id, isCorrect: false },
        });
        const attemptResult = resolveChallengeAttempt({
          points: item.externalChallenge.points,
          penaltyPerWrongAttempt: item.challengeGrading.penaltyPerWrongAttempt,
          previousWrongAttempts,
          requiresCorrectFlag,
          flagCorrect,
        });
        const attemptNumber = attemptsCount + 1;
        const submission = await transaction.challengeSubmission.upsert({
          where: { itemId_userId: { itemId: item.id, userId: user.id } },
          create: {
            itemId: item.id,
            userId: user.id,
            attemptsCount: attemptNumber,
            completedAt: attemptResult.completed ? now : null,
            score: attemptResult.score,
            writeup: submittedValues.data.writeup,
            writeupUrl: submittedValues.data.writeupUrl,
          },
          update: {
            attemptsCount: attemptNumber,
            completedAt: attemptResult.completed ? now : null,
            score: attemptResult.score,
            writeup: submittedValues.data.writeup,
            writeupUrl: submittedValues.data.writeupUrl,
          },
          select: { id: true },
        });
        await transaction.challengeAttempt.create({
          data: {
            itemId: item.id,
            userId: user.id,
            attemptNumber,
            isCorrect: flagCorrect,
            scoreAfterAttempt: attemptResult.score,
          },
        });
        await transaction.auditLog.create({
          data: {
            actorId: user.id,
            organizationId,
            action: "CHALLENGE_ATTEMPT_SUBMITTED",
            targetType: "CHALLENGE_SUBMISSION",
            targetId: submission.id,
            metadata: {
              assignmentId,
              assignmentItemId: item.id,
              attemptNumber,
              isCorrect: flagCorrect,
              completed: attemptResult.completed,
              score: attemptResult.score,
              wrongAttempts: attemptResult.nextWrongAttempts,
              hasWriteup: submittedValues.data.writeup !== null,
              hasWriteupUrl: submittedValues.data.writeupUrl !== null,
              late: now > item.assignment.deadline,
            },
          },
        });

        return attemptResult.completed
          ? ({ status: "completed", itemId: item.id } as const)
          : ({ status: "incorrect", itemId: item.id } as const);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch {
    assignmentChallengeRedirect(
      organizationId,
      assignmentId,
      { error: "submit_failed" },
      parsed.data.itemId,
    );
  }

  if (result.status === "error") {
    assignmentChallengeRedirect(
      organizationId,
      assignmentId,
      { error: result.error },
      result.itemId,
    );
  }
  if (result.status === "incorrect") {
    assignmentChallengeRedirect(
      organizationId,
      assignmentId,
      { error: "incorrect_flag" },
      result.itemId,
    );
  }
  assignmentChallengeRedirect(
    organizationId,
    assignmentId,
    { success: "completed" },
    result.itemId,
  );
}

export async function moveExternalChallenge(formData: FormData) {
  const context = parseChallengeContext(formData);
  if (!context.success) redirect("/dashboard?challenge_error=invalid_input");

  const parsed = moveExternalChallengeSchema.safeParse(Object.fromEntries(formData));
  const { organizationId, assignmentId } = context.data;
  if (!parsed.success) {
    challengeStatusRedirect(organizationId, assignmentId, { error: "invalid_input" });
  }

  const { user } = await requireOrganizationAccess(organizationId, true);
  let result:
    | { status: "moved" | "unchanged"; itemId: string }
    | { status: "error"; itemId: string; error: string };
  try {
    result = await prisma.$transaction(
      async (transaction) => {
        const currentMembership = await transaction.organizationMember.findUnique({
          where: { organizationId_userId: { organizationId, userId: user.id } },
        });
        if (
          !canManageOrganization({
            systemRole: user.systemRole,
            membership: currentMembership,
          })
        ) {
          return { status: "error", itemId: parsed.data.itemId, error: "forbidden" } as const;
        }

        const item = await transaction.assignmentItem.findFirst({
          where: {
            id: parsed.data.itemId,
            assignmentId,
            type: AssignmentItemType.EXTERNAL_CHALLENGE,
            assignment: { organizationId, archivedAt: null },
          },
          select: { id: true, position: true },
        });
        if (!item) {
          return {
            status: "error",
            itemId: parsed.data.itemId,
            error: "item_not_found",
          } as const;
        }

        const adjacentItem = await transaction.assignmentItem.findFirst({
          where: {
            assignmentId,
            position:
              parsed.data.direction === "UP"
                ? { lt: item.position }
                : { gt: item.position },
          },
          orderBy: {
            position: parsed.data.direction === "UP" ? "desc" : "asc",
          },
          select: { id: true, position: true },
        });
        if (!adjacentItem) {
          await transaction.auditLog.create({
            data: {
              actorId: user.id,
              organizationId,
              action: "EXTERNAL_CHALLENGE_MOVE_SKIPPED",
              targetType: "ASSIGNMENT_ITEM",
              targetId: item.id,
              metadata: {
                assignmentId,
                direction: parsed.data.direction,
                position: item.position,
                reason: "BOUNDARY",
              },
            },
          });
          return { status: "unchanged", itemId: item.id } as const;
        }

        const positions = await transaction.assignmentItem.aggregate({
          where: { assignmentId },
          _max: { position: true },
        });
        const currentMaximumPosition = positions._max.position;
        if (currentMaximumPosition === null || currentMaximumPosition >= 2_147_483_647) {
          return {
            status: "error",
            itemId: item.id,
            error: "position_unavailable",
          } as const;
        }
        const temporaryPosition = currentMaximumPosition + 1;

        await transaction.assignmentItem.update({
          where: { id: adjacentItem.id },
          data: { position: temporaryPosition },
        });
        await transaction.assignmentItem.update({
          where: { id: item.id },
          data: { position: adjacentItem.position },
        });
        await transaction.assignmentItem.update({
          where: { id: adjacentItem.id },
          data: { position: item.position },
        });
        await transaction.auditLog.create({
          data: {
            actorId: user.id,
            organizationId,
            action: "EXTERNAL_CHALLENGE_MOVED",
            targetType: "ASSIGNMENT_ITEM",
            targetId: item.id,
            metadata: {
              assignmentId,
              direction: parsed.data.direction,
              fromPosition: item.position,
              toPosition: adjacentItem.position,
            },
          },
        });
        return { status: "moved", itemId: item.id } as const;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch {
    challengeStatusRedirect(
      organizationId,
      assignmentId,
      { error: "move_failed" },
      parsed.data.itemId,
    );
  }

  if (result.status === "error") {
    challengeStatusRedirect(
      organizationId,
      assignmentId,
      { error: result.error },
      result.itemId,
    );
  }
  challengeStatusRedirect(
    organizationId,
    assignmentId,
    { success: result.status === "moved" ? "moved" : "unchanged" },
    result.itemId,
  );
}
