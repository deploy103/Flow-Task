import { MembershipStatus, SystemRole } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { canDownloadQuizAnswerFile } from "./file-access";

describe("quiz answer file access", () => {
  it("allows only an active owner or reviewer in the organization", () => {
    const base = { userId: "owner", ownerId: "owner", systemRole: SystemRole.USER, membershipStatus: MembershipStatus.ACTIVE, canReview: false, archivedAt: null };
    expect(canDownloadQuizAnswerFile(base)).toBe(true);
    expect(canDownloadQuizAnswerFile({ ...base, userId: "other" })).toBe(false);
    expect(canDownloadQuizAnswerFile({ ...base, userId: "mentor", canReview: true })).toBe(true);
    expect(canDownloadQuizAnswerFile({ ...base, membershipStatus: MembershipStatus.INACTIVE })).toBe(false);
  });
});
