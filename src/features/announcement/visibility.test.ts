import { AnnouncementAudience, SystemRole } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { canViewAnnouncement } from "./visibility";

const baseInput = {
  userId: "user-a",
  systemRole: SystemRole.USER,
  canManage: false,
};

describe("announcement visibility", () => {
  it("allows active organization members to view all-member announcements", () => {
    expect(canViewAnnouncement({ ...baseInput, audience: AnnouncementAudience.ALL_MEMBERS, recipientIds: [] })).toBe(true);
  });

  it("limits selected announcements to their recipients", () => {
    expect(canViewAnnouncement({ ...baseInput, audience: AnnouncementAudience.SELECTED_MEMBERS, recipientIds: ["user-a"] })).toBe(true);
    expect(canViewAnnouncement({ ...baseInput, audience: AnnouncementAudience.SELECTED_MEMBERS, recipientIds: ["user-b"] })).toBe(false);
  });

  it("allows managers and system administrators regardless of audience", () => {
    expect(canViewAnnouncement({ ...baseInput, audience: AnnouncementAudience.SELECTED_MEMBERS, recipientIds: [], canManage: true })).toBe(true);
    expect(canViewAnnouncement({ ...baseInput, audience: AnnouncementAudience.SELECTED_MEMBERS, recipientIds: [], systemRole: SystemRole.SYSTEM_ADMIN })).toBe(true);
  });
});
