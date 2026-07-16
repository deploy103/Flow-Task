import { AnnouncementAudience, type SystemRole } from "@prisma/client";
import { SystemRole as SystemRoleValue } from "@prisma/client";

type AnnouncementVisibilityInput = {
  audience: AnnouncementAudience;
  recipientIds: string[];
  userId: string;
  systemRole: SystemRole;
  canManage: boolean;
};

export function canViewAnnouncement(input: AnnouncementVisibilityInput) {
  if (input.systemRole === SystemRoleValue.SYSTEM_ADMIN || input.canManage) return true;
  if (input.audience === AnnouncementAudience.ALL_MEMBERS) return true;
  return input.recipientIds.includes(input.userId);
}
