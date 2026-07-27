import { MembershipStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { ACTIVE_ORGANIZATION_MEMBER_COUNT_SELECT } from "./query-options";

describe("organization query options", () => {
  it("counts only active memberships on organization cards", () => {
    expect(ACTIVE_ORGANIZATION_MEMBER_COUNT_SELECT).toEqual({
      members: { where: { status: MembershipStatus.ACTIVE } },
    });
  });
});
