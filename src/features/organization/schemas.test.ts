import { ClubPosition, MembershipRole, MentoringRole, SecurityTrack } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { invitationSchema, joinOrganizationSchema, leaveOrganizationSchema, organizationSettingsSchema, removeOrganizationMemberSchema, updateMemberRoleSchema } from "./schemas";

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

  it("requires an organization id and confirmation name to leave", () => {
    const input = {
      organizationId: "fd7736d1-ecc0-4c23-b12c-84077b66dca4",
      confirmationName: "보안 동아리",
    };
    expect(leaveOrganizationSchema.safeParse(input).success).toBe(true);
    expect(leaveOrganizationSchema.safeParse({ ...input, confirmationName: "" }).success).toBe(false);
    expect(leaveOrganizationSchema.safeParse({ ...input, organizationId: "invalid" }).success).toBe(false);
  });

  it("requires a target member and confirmation name when removing a member", () => {
    const input = { organizationId: "fd7736d1-ecc0-4c23-b12c-84077b66dca4", memberId: "5a9db51d-47e7-4da7-b90d-6bc2530098ab", confirmationName: "홍길동" };
    expect(removeOrganizationMemberSchema.safeParse(input).success).toBe(true);
    expect(removeOrganizationMemberSchema.safeParse({ ...input, memberId: "invalid" }).success).toBe(false);
    expect(removeOrganizationMemberSchema.safeParse({ ...input, confirmationName: "" }).success).toBe(false);
  });

  it("validates independent club position, track, and mentoring role", () => {
    expect(updateMemberRoleSchema.safeParse({
      organizationId: "fd7736d1-ecc0-4c23-b12c-84077b66dca4",
      memberId: "fd7736d1-ecc0-4c23-b12c-84077b66dca5",
      position: ClubPosition.VICE_PRESIDENT,
      securityTrack: SecurityTrack.CRYPTOGRAPHY,
      mentoringRole: MentoringRole.MENTOR,
    }).success).toBe(true);
    expect(updateMemberRoleSchema.parse({
      organizationId: "fd7736d1-ecc0-4c23-b12c-84077b66dca4",
      memberId: "fd7736d1-ecc0-4c23-b12c-84077b66dca5",
      position: ClubPosition.MEMBER,
      securityTrack: "",
      mentoringRole: MentoringRole.NONE,
    }).securityTrack).toBeNull();
  });
});
