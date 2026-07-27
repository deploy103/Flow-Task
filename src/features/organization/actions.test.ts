import { beforeEach, describe, expect, it, vi } from "vitest";
import { MembershipRole, MembershipStatus } from "@prisma/client";

const guard = vi.hoisted(() => ({ requireAuthenticatedUser: vi.fn(), requireOrganizationAccess: vi.fn() }));
const navigation = vi.hoisted(() => ({
  redirect: vi.fn((path: string): never => { throw new Error(`NEXT_REDIRECT:${path}`); }),
}));
const cache = vi.hoisted(() => ({ revalidatePath: vi.fn() }));
const transaction = vi.hoisted(() => ({
  organizationMember: { findUnique: vi.fn(), count: vi.fn(), update: vi.fn() },
  departmentMember: { deleteMany: vi.fn() },
  mentorRelation: { updateMany: vi.fn() },
  question: { updateMany: vi.fn() },
  organizationInvite: { updateMany: vi.fn() },
  auditLog: { create: vi.fn() },
}));
const database = vi.hoisted(() => ({ $transaction: vi.fn() }));

vi.mock("@/features/auth/guards", () => guard);
vi.mock("@/features/organization/guards", () => ({ requireOrganizationAccess: guard.requireOrganizationAccess }));
vi.mock("next/navigation", () => navigation);
vi.mock("next/cache", () => cache);
vi.mock("@/lib/prisma", () => ({ prisma: database }));

import { leaveOrganization, removeOrganizationMember } from "./actions";

const USER_ID = "550e8400-e29b-41d4-a716-446655440000";
const ORGANIZATION_ID = "550e8400-e29b-41d4-a716-446655440001";
const MEMBER_ID = "550e8400-e29b-41d4-a716-446655440002";

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

describe("organization membership actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    guard.requireAuthenticatedUser.mockResolvedValue({ id: USER_ID });
    guard.requireOrganizationAccess.mockResolvedValue({ user: { id: USER_ID } });
    transaction.organizationMember.findUnique.mockResolvedValue({
      userId: USER_ID,
      role: MembershipRole.MEMBER,
      status: MembershipStatus.ACTIVE,
      organization: { name: "보안 동아리", archivedAt: null },
    });
    transaction.organizationMember.count.mockResolvedValue(2);
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

  it("removes a member and cleans up organization-scoped active access", async () => {
    transaction.organizationMember.findUnique.mockResolvedValue({
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
    transaction.organizationMember.findUnique.mockResolvedValue({
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
});
