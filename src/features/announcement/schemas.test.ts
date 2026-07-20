import { AnnouncementAudience, AnnouncementPriority } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { createAnnouncementSchema, recipientIdsSchema } from "./schemas";

describe("announcement schemas", () => {
  it("accepts a valid announcement", () => {
    const result = createAnnouncementSchema.safeParse({ organizationId: "fd7736d1-ecc0-4c23-b12c-84077b66dca4", title: "수업 안내", content: "금요일 수업을 확인하세요.", priority: AnnouncementPriority.IMPORTANT, audience: AnnouncementAudience.ALL_MEMBERS });
    expect(result.success).toBe(true);
  });

  it("rejects empty or overly long content", () => {
    const result = createAnnouncementSchema.safeParse({ organizationId: "fd7736d1-ecc0-4c23-b12c-84077b66dca4", title: "", content: "a".repeat(10_001), priority: AnnouncementPriority.NORMAL, audience: AnnouncementAudience.ALL_MEMBERS });
    expect(result.success).toBe(false);
  });

  it("limits recipient count and validates UUIDs", () => {
    expect(recipientIdsSchema.safeParse(["not-a-uuid"]).success).toBe(false);
    expect(recipientIdsSchema.safeParse(Array.from({ length: 501 }, () => "fd7736d1-ecc0-4c23-b12c-84077b66dca4")).success).toBe(false);
  });
});
