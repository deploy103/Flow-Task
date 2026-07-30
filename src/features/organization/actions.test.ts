import { beforeEach, describe, expect, it, vi } from "vitest";
import { ClubPosition, MembershipRole, MembershipStatus, MentoringRole, SecurityTrack, SystemRole } from "@prisma/client";

const guard = vi.hoisted(() => ({ requireAuthenticatedUser: vi.fn(), requireOrganizationAccess: vi.fn() }));
const navigation = vi.hoisted(() => ({
  redirect: vi.fn((path: string): never => { throw new Error(`NEXT_REDIRECT:${path}`); }),
}));
const cache = vi.hoisted(() => ({ revalidatePath: vi.fn() }));
const transaction = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  organizationMember: { findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn(), update: vi.fn() },
  departmentMember: { deleteMany: vi.fn() },
  mentorRelation: { findMany: vi.fn(), updateMany: vi.fn() },
  question: { updateMany: vi.fn() },
  organizationInvite: { findFirst: vi.fn(), updateMany: vi.fn() },
  auditLog: { create: vi.fn() },
}));
const database = vi.hoisted(() => ({ $transaction: vi.fn() }));

vi.mock("@/features/auth/guards", () => guard);
vi.mock("@/features/organization/guards", () => ({ requireOrganizationAccess: guard.requireOrganizationAccess }));
vi.mock("next/navigation", () => navigation);
vi.mock("next/cache", () => cache);
vi.mock("@/lib/prisma", () => ({ prisma: database }));

import { leaveOrganization, removeOrganizationMember, revokeOrganizationInvitation, updateMemberRole } from "./actions";

const USER_ID = "550e8400-e29b-41d4-a716-446655440000";
const ORGANIZATION_ID = "550e8400-e29b-41d4-a716-446655440001";
const MEMBER_ID = "550e8400-e29b-41d4-a716-446655440002";
const INVITATION_ID = "550e8400-e29b-41d4-a716-446655440003";

function leaveForm(confirmationName = "보안 동아리") {
  const formData = new FormData();
  formData.set("organizationId", ORGANIZATION_ID);
  formData.set("confirmationName", confirmationName);
  return formData;
}

function removeForm(confirmationName = "홍길동") {
  const formData = new FormData();
  formData.set("organizationId", ORGANIZATION_ID);
  formData.set("memberId", MEMBER_ID);
  formData.set("confirmationName", confirmationName);
  return formData;
}

function revokeInvitationForm() {
  const formData = new FormData();
  formData.set("organizationId", ORGANIZATION_ID);
  formData.set("invitationId", INVITATION_ID);
  return formData;
}

function updateMemberForm() {
  const formData = new FormData();
  formData.set("organizationId", ORGANIZATION_ID);
  formData.set("memberId", MEMBER_ID);
  formData.set("position", ClubPosition.MEMBER);
  formData.set("securityTrack", SecurityTrack.FORENSICS);
  formData.set("mentoringRole", MentoringRole.MENTOR);
  return formData;
}

describe("organization membership actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    guard.requireAuthenticatedUser.mockResolvedValue({ id: USER_ID });
    guard.requireOrganizationAccess.mockResolvedValue({ user: { id: USER_ID } });
    transaction.user.findUnique.mockResolvedValue({ systemRole: SystemRole.USER });
    transaction.organizationMember.findUnique.mockResolvedValue({
      userId: USER_ID,
      role: MembershipRole.MEMBER,
      status: MembershipStatus.ACTIVE,
      organization: { name: "보안 동아리", archivedAt: null },
    });
    transaction.organizationMember.count.mockResolvedValue(2);
    transaction.organizationMember.findMany.mockResolvedValue([]);
    transaction.mentorRelation.findMany.mockResolvedValue([]);
    transaction.mentorRelation.updateMany.mockResolvedValue({ count: 1 });
    transaction.organizationInvite.updateMany.mockResolvedValue({ count: 1 });
    database.$transaction.mockImplementation(async (callback: (client: typeof transaction) => unknown) => callback(transaction));
  });

  it("deactivates only the authenticated user's membership and related active relations", async () => {
    await expect(leaveOrganization(leaveForm())).rejects.toThrow(
      "NEXT_REDIRECT:/profile?message=organization_left#organizations",
    );

    expect(transaction.departmentMember.deleteMany).toHaveBeenCalledWith({
      where: { userId: USER_ID, department: { organizationId: ORGANIZATION_ID } },
    });
    expect(transaction.mentorRelation.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ organizationId: ORGANIZATION_ID, OR: [{ mentorId: USER_ID }, { menteeId: USER_ID }] }),
    }));
    expect(transaction.organizationMember.update).toHaveBeenCalledWith({
      where: { organizationId_userId: { organizationId: ORGANIZATION_ID, userId: USER_ID } },
      data: { status: MembershipStatus.INACTIVE },
    });
  });

  it("blocks the last active administrator from leaving", async () => {
    transaction.organizationMember.findUnique.mockResolvedValue({
      userId: USER_ID,
      role: MembershipRole.ORG_ADMIN,
      status: MembershipStatus.ACTIVE,
      organization: { name: "보안 동아리", archivedAt: null },
    });
    transaction.organizationMember.count.mockResolvedValue(1);

    await expect(leaveOrganization(leaveForm())).rejects.toThrow(
      "NEXT_REDIRECT:/profile?error=last_organization_admin#organizations",
    );
    expect(transaction.organizationMember.update).not.toHaveBeenCalled();
  });

  it("requires the exact organization name", async () => {
    await expect(leaveOrganization(leaveForm("다른 이름"))).rejects.toThrow(
      "NEXT_REDIRECT:/profile?error=organization_name_mismatch#organizations",
    );
    expect(transaction.organizationMember.update).not.toHaveBeenCalled();
  });

  it("ends mentor relations invalidated by a classification change", async () => {
    transaction.organizationMember.findUnique.mockResolvedValue({
      userId: MEMBER_ID,
      role: MembershipRole.MENTOR,
      status: MembershipStatus.ACTIVE,
    });
    transaction.mentorRelation.findMany.mockResolvedValue([
      { id: "relation-1", mentorId: MEMBER_ID, menteeId: USER_ID },
    ]);
    transaction.organizationMember.findMany.mockResolvedValue([
      { userId: MEMBER_ID, mentoringRole: MentoringRole.MENTOR, securityTrack: SecurityTrack.FORENSICS, status: MembershipStatus.ACTIVE },
      { userId: USER_ID, mentoringRole: MentoringRole.MENTEE, securityTrack: SecurityTrack.WEB, status: MembershipStatus.ACTIVE },
    ]);

    await expect(updateMemberRole(updateMemberForm())).rejects.toThrow(
      `NEXT_REDIRECT:/organizations/${ORGANIZATION_ID}/members?message=role_updated`,
    );

    expect(transaction.mentorRelation.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["relation-1"] }, organizationId: ORGANIZATION_ID, endedAt: null },
      data: { endedAt: expect.any(Date) },
    });
    expect(transaction.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "MEMBER_ROLE_UPDATED",
        metadata: expect.objectContaining({ endedMentorRelationIds: ["relation-1"] }),
      }),
    });
  });

  it("removes a member and cleans up organization-scoped active access", async () => {
    transaction.organizationMember.findUnique.mockImplementation(async ({ where }: { where: { organizationId_userId: { userId: string } } }) => where.organizationId_userId.userId === USER_ID ? {
      role: MembershipRole.ORG_ADMIN,
      status: MembershipStatus.ACTIVE,
    } : {
      userId: MEMBER_ID,
      role: MembershipRole.MENTOR,
      status: MembershipStatus.ACTIVE,
      user: { name: "홍길동" },
      organization: { archivedAt: null },
    });

    await expect(removeOrganizationMember(removeForm())).rejects.toThrow(
      `NEXT_REDIRECT:/organizations/${ORGANIZATION_ID}/members?message=member_removed`,
    );
    expect(transaction.departmentMember.deleteMany).toHaveBeenCalledWith({
      where: { userId: MEMBER_ID, department: { organizationId: ORGANIZATION_ID } },
    });
    expect(transaction.mentorRelation.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ organizationId: ORGANIZATION_ID, OR: [{ mentorId: MEMBER_ID }, { menteeId: MEMBER_ID }] }),
    }));
    expect(transaction.question.updateMany).toHaveBeenNthCalledWith(1, {
      where: { organizationId: ORGANIZATION_ID, assignedMentorId: MEMBER_ID, status: "IN_PROGRESS" },
      data: { assignedMentorId: null, status: "WAITING" },
    });
    expect(transaction.question.updateMany).toHaveBeenNthCalledWith(2, {
      where: { organizationId: ORGANIZATION_ID, assignedMentorId: MEMBER_ID }, data: { assignedMentorId: null },
    });
    expect(transaction.organizationInvite.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { organizationId: ORGANIZATION_ID, createdById: MEMBER_ID, revokedAt: null },
    }));
    expect(transaction.organizationMember.update).toHaveBeenCalledWith({
      where: { organizationId_userId: { organizationId: ORGANIZATION_ID, userId: MEMBER_ID } },
      data: { status: MembershipStatus.INACTIVE },
    });
  });

  it("does not remove the last active organization administrator", async () => {
    transaction.organizationMember.findUnique.mockImplementation(async ({ where }: { where: { organizationId_userId: { userId: string } } }) => where.organizationId_userId.userId === USER_ID ? {
      role: MembershipRole.ORG_ADMIN,
      status: MembershipStatus.ACTIVE,
    } : {
      userId: MEMBER_ID,
      role: MembershipRole.ORG_ADMIN,
      status: MembershipStatus.ACTIVE,
      user: { name: "홍길동" },
      organization: { archivedAt: null },
    });
    transaction.organizationMember.count.mockResolvedValue(1);

    await expect(removeOrganizationMember(removeForm())).rejects.toThrow(
      `NEXT_REDIRECT:/organizations/${ORGANIZATION_ID}/members?error=last_admin`,
    );
    expect(transaction.organizationMember.update).not.toHaveBeenCalled();
  });

  it("performs no cleanup when the actor's organization authority was revoked", async () => {
    transaction.organizationMember.findUnique.mockResolvedValue({
      role: MembershipRole.MEMBER,
      status: MembershipStatus.INACTIVE,
    });

    await expect(removeOrganizationMember(removeForm())).rejects.toThrow(
      `NEXT_REDIRECT:/organizations/${ORGANIZATION_ID}/members?error=remove_failed`,
    );
    expect(transaction.departmentMember.deleteMany).not.toHaveBeenCalled();
    expect(transaction.mentorRelation.updateMany).not.toHaveBeenCalled();
    expect(transaction.question.updateMany).not.toHaveBeenCalled();
    expect(transaction.organizationInvite.updateMany).not.toHaveBeenCalled();
    expect(transaction.organizationMember.update).not.toHaveBeenCalled();
    expect(transaction.auditLog.create).not.toHaveBeenCalled();
  });

  it("revokes only an invitation in the requested organization", async () => {
    transaction.organizationMember.findUnique.mockResolvedValue({
      role: MembershipRole.ORG_ADMIN,
      status: MembershipStatus.ACTIVE,
    });
    transaction.organizationInvite.findFirst.mockResolvedValue({
      id: INVITATION_ID,
      expiresAt: new Date("2099-01-01T00:00:00.000Z"),
      maxUses: 10,
      revokedAt: null,
      usedCount: 2,
      organization: { archivedAt: null },
    });

    await expect(revokeOrganizationInvitation(revokeInvitationForm())).rejects.toThrow(
      `NEXT_REDIRECT:/organizations/${ORGANIZATION_ID}/members?message=invitation_revoked`,
    );
    expect(transaction.organizationInvite.findFirst).toHaveBeenCalledWith({
      where: { id: INVITATION_ID, organizationId: ORGANIZATION_ID },
      select: {
        id: true,
        expiresAt: true,
        maxUses: true,
        revokedAt: true,
        usedCount: true,
        organization: { select: { archivedAt: true } },
      },
    });
    expect(transaction.organizationInvite.updateMany).toHaveBeenCalledWith({
      where: {
        id: INVITATION_ID,
        organizationId: ORGANIZATION_ID,
        revokedAt: null,
        expiresAt: { gt: expect.any(Date) },
        maxUses: 10,
        usedCount: 2,
      },
      data: { revokedAt: expect.any(Date) },
    });
    expect(transaction.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "INVITATION_REVOKED", targetId: INVITATION_ID }),
    });
  });

  it("does not inspect or revoke invitations after the actor loses authority", async () => {
    transaction.organizationMember.findUnique.mockResolvedValue({
      role: MembershipRole.MEMBER,
      status: MembershipStatus.INACTIVE,
    });

    await expect(revokeOrganizationInvitation(revokeInvitationForm())).rejects.toThrow(
      `NEXT_REDIRECT:/organizations/${ORGANIZATION_ID}/members?error=invitation_revoke_failed`,
    );
    expect(transaction.organizationInvite.findFirst).not.toHaveBeenCalled();
    expect(transaction.organizationInvite.updateMany).not.toHaveBeenCalled();
    expect(transaction.auditLog.create).not.toHaveBeenCalled();
  });

  it("does not revoke an invitation that is outside the requested organization", async () => {
    transaction.organizationMember.findUnique.mockResolvedValue({
      role: MembershipRole.ORG_ADMIN,
      status: MembershipStatus.ACTIVE,
    });
    transaction.organizationInvite.findFirst.mockResolvedValue(null);

    await expect(revokeOrganizationInvitation(revokeInvitationForm())).rejects.toThrow(
      `NEXT_REDIRECT:/organizations/${ORGANIZATION_ID}/members?error=invitation_revoke_failed`,
    );
    expect(transaction.organizationInvite.updateMany).not.toHaveBeenCalled();
    expect(transaction.auditLog.create).not.toHaveBeenCalled();
  });

  it.each([
    ["expired", { expiresAt: new Date("2020-01-01T00:00:00.000Z"), maxUses: 10, usedCount: 0 }],
    ["exhausted", { expiresAt: new Date("2099-01-01T00:00:00.000Z"), maxUses: 3, usedCount: 3 }],
  ])("does not revoke an %s invitation", async (_state, invitationState) => {
    transaction.organizationMember.findUnique.mockResolvedValue({
      role: MembershipRole.ORG_ADMIN,
      status: MembershipStatus.ACTIVE,
    });
    transaction.organizationInvite.findFirst.mockResolvedValue({
      id: INVITATION_ID,
      ...invitationState,
      revokedAt: null,
      organization: { archivedAt: null },
    });

    await expect(revokeOrganizationInvitation(revokeInvitationForm())).rejects.toThrow(
      `NEXT_REDIRECT:/organizations/${ORGANIZATION_ID}/members?error=invitation_revoke_failed`,
    );
    expect(transaction.organizationInvite.updateMany).not.toHaveBeenCalled();
    expect(transaction.auditLog.create).not.toHaveBeenCalled();
  });
});
