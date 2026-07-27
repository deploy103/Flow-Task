import { beforeEach, describe, expect, it, vi } from "vitest";
import { MembershipRole, MembershipStatus } from "@prisma/client";

const guard = vi.hoisted(() => ({ requireAuthenticatedUser: vi.fn() }));
const navigation = vi.hoisted(() => ({
  redirect: vi.fn((path: string): never => { throw new Error(`NEXT_REDIRECT:${path}`); }),
}));
const cache = vi.hoisted(() => ({ revalidatePath: vi.fn() }));
const transaction = vi.hoisted(() => ({
  organizationMember: { findUnique: vi.fn(), count: vi.fn(), update: vi.fn() },
  departmentMember: { deleteMany: vi.fn() },
  mentorRelation: { updateMany: vi.fn() },
  auditLog: { create: vi.fn() },
}));
const database = vi.hoisted(() => ({ $transaction: vi.fn() }));

vi.mock("@/features/auth/guards", () => guard);
vi.mock("next/navigation", () => navigation);
vi.mock("next/cache", () => cache);
vi.mock("@/lib/prisma", () => ({ prisma: database }));

import { leaveOrganization } from "./actions";

const USER_ID = "550e8400-e29b-41d4-a716-446655440000";
const ORGANIZATION_ID = "550e8400-e29b-41d4-a716-446655440001";

function leaveForm(confirmationName = "보안 동아리") {
  const formData = new FormData();
  formData.set("organizationId", ORGANIZATION_ID);
  formData.set("confirmationName", confirmationName);
  return formData;
}

describe("organization membership actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    guard.requireAuthenticatedUser.mockResolvedValue({ id: USER_ID });
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
});
