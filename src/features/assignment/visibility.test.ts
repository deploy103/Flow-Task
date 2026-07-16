import { AssignmentAudience, SystemRole } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { canViewAssignment, isAssignmentPublished } from "./visibility";

const baseInput = {
  userId: "user-a",
  systemRole: SystemRole.USER,
  canManage: false,
};

describe("assignment visibility", () => {
  it("allows organization members to view all-member assignments", () => {
    expect(canViewAssignment({ ...baseInput, audience: AssignmentAudience.ALL_MEMBERS, targetUserIds: [] })).toBe(true);
  });

  it("limits selected assignments to selected users", () => {
    expect(canViewAssignment({ ...baseInput, audience: AssignmentAudience.SELECTED_MEMBERS, targetUserIds: ["user-a"] })).toBe(true);
    expect(canViewAssignment({ ...baseInput, audience: AssignmentAudience.SELECTED_MEMBERS, targetUserIds: ["user-b"] })).toBe(false);
  });

  it("allows administrators regardless of assignment target", () => {
    expect(canViewAssignment({ ...baseInput, audience: AssignmentAudience.SELECTED_MEMBERS, targetUserIds: [], canManage: true })).toBe(true);
    expect(canViewAssignment({ ...baseInput, audience: AssignmentAudience.SELECTED_MEMBERS, targetUserIds: [], systemRole: SystemRole.SYSTEM_ADMIN })).toBe(true);
  });

  it("does not publish an assignment before its opening date", () => {
    const now = new Date("2026-07-16T00:00:00Z");
    expect(isAssignmentPublished(new Date("2026-07-16T00:00:01Z"), now)).toBe(false);
    expect(isAssignmentPublished(new Date("2026-07-16T00:00:00Z"), now)).toBe(true);
  });
});
