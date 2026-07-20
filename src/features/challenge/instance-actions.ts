"use server";

import { createHash, randomUUID } from "node:crypto";
import { ChallengeInstanceStatus, InternalChallengeMode, MembershipStatus, Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireOrganizationAccess } from "@/features/organization/guards";
import { canSubmitAssignment } from "@/features/submission/access";
import { prisma } from "@/lib/prisma";
import { createRemoteChallengeInstance, stopRemoteChallengeInstance } from "./instance-provider";

const schema = z.object({ organizationId: z.uuid(), assignmentId: z.uuid(), itemId: z.uuid() });
const path = (input: z.infer<typeof schema>, error?: string) => `/organizations/${input.organizationId}/assignments/${input.assignmentId}?challenge_item=${input.itemId}${error ? `&challenge_error=${error}` : "&challenge_success=instance_ready"}`;

export async function startChallengeInstance(formData: FormData) {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/dashboard?challenge_error=invalid_input");
  const input = parsed.data;
  const { user } = await requireOrganizationAccess(input.organizationId);
  let created: { id: string; idempotencyKey: string; templateRef: string; cpuMilli: number; memoryMb: number; lifetimeMinutes: number } | null = null;
  try {
    created = await prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw`SELECT "assignment_item_id" FROM "internal_challenges" WHERE "assignment_item_id" = ${input.itemId}::uuid FOR UPDATE`;
      const challenge = await transaction.internalChallenge.findFirst({ where: { assignmentItemId: input.itemId, mode: InternalChallengeMode.PERSONAL_INSTANCE, assignmentItem: { assignmentId: input.assignmentId, assignment: { organizationId: input.organizationId, archivedAt: null } } }, select: { instanceTemplateRef: true, instanceCpuMilli: true, instanceMemoryMb: true, instanceLifetimeMinutes: true, assignmentItem: { select: { assignment: { select: { audience: true, opensAt: true, deadline: true, allowLate: true, targets: { where: { userId: user.id }, select: { userId: true } } } } } } } });
      if (!challenge || !challenge.instanceTemplateRef || !challenge.instanceCpuMilli || !challenge.instanceMemoryMb || !challenge.instanceLifetimeMinutes) throw new Error("NOT_FOUND");
      const membership = await transaction.organizationMember.findFirst({ where: { organizationId: input.organizationId, userId: user.id, status: MembershipStatus.ACTIVE }, select: { status: true } });
      const assignment = challenge.assignmentItem.assignment; const now = new Date();
      const allowed = canSubmitAssignment({ audience: assignment.audience, targetUserIds: assignment.targets.map(({ userId }) => userId), userId: user.id, membershipStatus: membership?.status });
      if (!allowed || now < assignment.opensAt || (now > assignment.deadline && !assignment.allowLate)) throw new Error("FORBIDDEN");
      await transaction.challengeInstance.updateMany({ where: { assignmentItemId: input.itemId, userId: user.id, status: { in: [ChallengeInstanceStatus.STARTING, ChallengeInstanceStatus.RUNNING] }, expiresAt: { lte: now } }, data: { status: ChallengeInstanceStatus.EXPIRED, stoppedAt: now } });
      const active = await transaction.challengeInstance.findFirst({ where: { assignmentItemId: input.itemId, userId: user.id, status: { in: [ChallengeInstanceStatus.STARTING, ChallengeInstanceStatus.RUNNING] }, expiresAt: { gt: now } }, select: { id: true } });
      if (active) return null;
      const idempotencyKey = createHash("sha256").update(`${input.itemId}:${user.id}:${randomUUID()}`).digest("hex");
      const instance = await transaction.challengeInstance.create({ data: { assignmentItemId: input.itemId, userId: user.id, idempotencyKey, expiresAt: new Date(now.getTime() + challenge.instanceLifetimeMinutes * 60_000) }, select: { id: true } });
      return { ...instance, idempotencyKey, templateRef: challenge.instanceTemplateRef, cpuMilli: challenge.instanceCpuMilli, memoryMb: challenge.instanceMemoryMb, lifetimeMinutes: challenge.instanceLifetimeMinutes };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch { redirect(path(input, "instance_forbidden")); }
  if (!created) redirect(path(input));
  let remote;
  try { remote = await createRemoteChallengeInstance({ instanceId: created.id, idempotencyKey: created.idempotencyKey, templateRef: created.templateRef, cpuMilli: created.cpuMilli, memoryMb: created.memoryMb, lifetimeMinutes: created.lifetimeMinutes }); }
  catch { await prisma.challengeInstance.updateMany({ where: { id: created.id, status: ChallengeInstanceStatus.STARTING }, data: { status: ChallengeInstanceStatus.FAILED, stoppedAt: new Date() } }); redirect(path(input, "instance_start_failed")); }
  try {
    await prisma.$transaction(async (transaction) => {
      const activated = await transaction.challengeInstance.updateMany({ where: { id: created.id, status: ChallengeInstanceStatus.STARTING }, data: { status: ChallengeInstanceStatus.RUNNING, providerReference: remote.providerReference, connectionHost: remote.host, connectionPort: remote.port, connectionProtocol: remote.protocol } });
      if (!activated.count) throw new Error("INSTANCE_NO_LONGER_STARTING");
      await transaction.auditLog.create({ data: { actorId: user.id, organizationId: input.organizationId, action: "CHALLENGE_INSTANCE_STARTED", targetType: "CHALLENGE_INSTANCE", targetId: created.id, metadata: { assignmentItemId: input.itemId, expiresInMinutes: created.lifetimeMinutes } } });
    });
  } catch { await stopRemoteChallengeInstance(remote.providerReference).catch(() => undefined); redirect(path(input, "instance_start_failed")); }
  redirect(path(input));
}

export async function stopChallengeInstance(formData: FormData) {
  const parsed = schema.extend({ instanceId: z.uuid() }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/dashboard?challenge_error=invalid_input");
  const input = parsed.data;
  const { user } = await requireOrganizationAccess(input.organizationId);
  const instance = await prisma.challengeInstance.findFirst({ where: { id: input.instanceId, assignmentItemId: input.itemId, userId: user.id, status: { in: [ChallengeInstanceStatus.STARTING, ChallengeInstanceStatus.RUNNING] }, challenge: { assignmentItem: { assignmentId: input.assignmentId, assignment: { organizationId: input.organizationId } } } }, select: { id: true, providerReference: true } });
  if (!instance) redirect(path(input, "instance_not_found"));
  try { if (instance.providerReference) await stopRemoteChallengeInstance(instance.providerReference); }
  catch { redirect(path(input, "instance_stop_failed")); }
  await prisma.$transaction([
    prisma.challengeInstance.update({ where: { id: instance.id }, data: { status: ChallengeInstanceStatus.STOPPED, stoppedAt: new Date() } }),
    prisma.auditLog.create({ data: { actorId: user.id, organizationId: input.organizationId, action: "CHALLENGE_INSTANCE_STOPPED", targetType: "CHALLENGE_INSTANCE", targetId: instance.id, metadata: { assignmentItemId: input.itemId } } }),
  ]);
  redirect(path(input));
}
