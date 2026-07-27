export type InvitationStatus = "ACTIVE" | "EXHAUSTED" | "EXPIRED" | "REVOKED";

type InvitationStatusInput = {
  expiresAt: Date;
  maxUses: number | null;
  revokedAt: Date | null;
  usedCount: number;
};

export function getInvitationStatus(invitation: InvitationStatusInput, now = new Date()): InvitationStatus {
  if (invitation.revokedAt) return "REVOKED";
  if (invitation.expiresAt <= now) return "EXPIRED";
  if (invitation.maxUses !== null && invitation.usedCount >= invitation.maxUses) return "EXHAUSTED";
  return "ACTIVE";
}
