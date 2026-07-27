import { describe, expect, it } from "vitest";
import { getInvitationStatus } from "./invitation-status";

const now = new Date("2026-07-27T12:00:00.000Z");

describe("organization invitation status", () => {
  it("reports an available invitation as active", () => {
    expect(getInvitationStatus({ expiresAt: new Date("2026-07-28T00:00:00.000Z"), maxUses: 5, usedCount: 2, revokedAt: null }, now)).toBe("ACTIVE");
  });

  it("prioritizes explicit revocation over other terminal states", () => {
    expect(getInvitationStatus({ expiresAt: new Date("2026-07-26T00:00:00.000Z"), maxUses: 1, usedCount: 1, revokedAt: now }, now)).toBe("REVOKED");
  });

  it("distinguishes expired and exhausted invitations", () => {
    expect(getInvitationStatus({ expiresAt: now, maxUses: 5, usedCount: 0, revokedAt: null }, now)).toBe("EXPIRED");
    expect(getInvitationStatus({ expiresAt: new Date("2026-07-28T00:00:00.000Z"), maxUses: 3, usedCount: 3, revokedAt: null }, now)).toBe("EXHAUSTED");
  });
});
