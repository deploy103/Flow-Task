import { MembershipRole } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { invitationSchema, joinOrganizationSchema, organizationSettingsSchema } from "./schemas";

describe("organization schemas", () => {
  it("rejects issuing administrator invitations", () => {
    const result = invitationSchema.safeParse({
      organizationId: "fd7736d1-ecc0-4c23-b12c-84077b66dca4",
      role: MembershipRole.ORG_ADMIN,
      expiresInDays: 7,
      maxUses: 10,
    });
    expect(result.success).toBe(false);
  });

  it("normalizes a valid invitation code", () => {
    const result = joinOrganizationSchema.parse({ invitationCode: "ab12cd34ef56" });
    expect(result.invitationCode).toBe("AB12CD34EF56");
  });

  it("rejects invitation limits outside policy", () => {
    const result = invitationSchema.safeParse({
      organizationId: "fd7736d1-ecc0-4c23-b12c-84077b66dca4",
      role: MembershipRole.MEMBER,
      expiresInDays: 31,
      maxUses: 501,
    });
    expect(result.success).toBe(false);
  });

  it("validates organization settings and normalizes an empty description", () => {
    const result = organizationSettingsSchema.parse({
      organizationId: "fd7736d1-ecc0-4c23-b12c-84077b66dca4",
      name: "보안 동아리",
      description: "",
      removeLogo: "on",
    });
    expect(result.description).toBeNull();
    expect(result.removeLogo).toBe(true);
  });
});
