import { describe, expect, it } from "vitest";
import { generateInvitationCode } from "./invitation-code";

describe("invitation codes", () => {
  it("creates a human-readable 12-character code", () => {
    expect(generateInvitationCode()).toMatch(/^[A-Z2-9]{12}$/);
  });

  it("does not repeatedly return the same code", () => {
    const codes = new Set(Array.from({ length: 20 }, generateInvitationCode));
    expect(codes.size).toBe(20);
  });
});
