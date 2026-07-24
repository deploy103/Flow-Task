import { describe, expect, it } from "vitest";
import { SystemRole } from "@prisma/client";
import { canChangeSystemRole, canDeleteManagedUser, deletedUserEmail, requiresEmailSecurityReset } from "./policy";

describe("system administrator management policy", () => {
  it("prevents self-demotion and removing the last administrator", () => {
    expect(canChangeSystemRole({ actorId: "a", targetId: "a", currentRole: SystemRole.SYSTEM_ADMIN, nextRole: SystemRole.USER, administratorCount: 2 })).toBe(false);
    expect(canChangeSystemRole({ actorId: "a", targetId: "b", currentRole: SystemRole.SYSTEM_ADMIN, nextRole: SystemRole.USER, administratorCount: 1 })).toBe(false);
    expect(canChangeSystemRole({ actorId: "a", targetId: "b", currentRole: SystemRole.SYSTEM_ADMIN, nextRole: SystemRole.USER, administratorCount: 2 })).toBe(true);
  });

  it("does not delete the actor or another administrator", () => {
    expect(canDeleteManagedUser("a", { id: "a", systemRole: SystemRole.USER })).toBe(false);
    expect(canDeleteManagedUser("a", { id: "b", systemRole: SystemRole.SYSTEM_ADMIN })).toBe(false);
    expect(canDeleteManagedUser("a", { id: "b", systemRole: SystemRole.USER })).toBe(true);
  });

  it("creates a non-routable unique anonymized address", () => {
    expect(deletedUserEmail("550e8400-e29b-41d4-a716-446655440000")).toBe("deleted-550e8400-e29b-41d4-a716-446655440000@deleted.invalid");
  });

  it("resets email security state only when the normalized address changes", () => {
    expect(requiresEmailSecurityReset("user@example.com", "new@example.com")).toBe(true);
    expect(requiresEmailSecurityReset("User@Example.com", " user@example.com ")).toBe(false);
  });
});
