import { MembershipStatus } from "@prisma/client";

/**
 * Inactive membership rows are retained for audit/history. Reuse this filter
 * anywhere that presents an organization's current member count.
 */
export const ACTIVE_ORGANIZATION_MEMBER_COUNT_SELECT = {
  members: { where: { status: MembershipStatus.ACTIVE } },
} as const;
