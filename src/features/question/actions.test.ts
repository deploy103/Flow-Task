import { MembershipRole, MembershipStatus, SystemRole } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  redirect: vi.fn((url: string) => { throw new Error(`REDIRECT:${url}`); }),
  requireOrganizationAccess: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/features/organization/guards", () => ({ requireOrganizationAccess: mocks.requireOrganizationAccess }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    organizationMember: { findMany: mocks.findMany },
    $transaction: mocks.transaction,
  },
}));

import { assignMentorRelation } from "./actions";

const organizationId = "00000000-0000-4000-8000-000000000001";
const mentorId = "00000000-0000-4000-8000-000000000002";
const menteeId = "00000000-0000-4000-8000-000000000003";

function relationForm() {
  const formData = new FormData();
  formData.set("organizationId", organizationId);
  formData.set("mentorId", mentorId);
  formData.set("menteeId", menteeId);
  formData.set("type", "PRIMARY");
  return formData;
}

describe("assignMentorRelation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireOrganizationAccess.mockResolvedValue({
      user: { id: "00000000-0000-4000-8000-000000000004", systemRole: SystemRole.USER },
    });
  });

  it.each([MembershipRole.MENTOR, MembershipRole.ORG_ADMIN])("rejects a manipulated %s mentee", async (menteeRole) => {
    mocks.findMany.mockResolvedValue([
      { userId: mentorId, role: MembershipRole.MENTOR, status: MembershipStatus.ACTIVE },
      { userId: menteeId, role: menteeRole, status: MembershipStatus.ACTIVE },
    ]);

    await expect(assignMentorRelation(relationForm())).rejects.toThrow(`REDIRECT:/organizations/${organizationId}/questions/mentors?error=invalid_members`);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
