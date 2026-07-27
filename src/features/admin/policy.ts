import { SystemRole } from "@prisma/client";

export function canChangeSystemRole(input: {
  actorId: string;
  targetId: string;
  currentRole: SystemRole;
  nextRole: SystemRole;
  administratorCount: number;
}) {
  if (input.actorId === input.targetId && input.nextRole !== SystemRole.SYSTEM_ADMIN) return false;
  if (
    input.currentRole === SystemRole.SYSTEM_ADMIN &&
    input.nextRole !== SystemRole.SYSTEM_ADMIN &&
    input.administratorCount <= 1
  ) return false;
  return true;
}

export function canDeleteManagedUser(actorId: string, target: { id: string; systemRole: SystemRole }) {
  return actorId !== target.id && target.systemRole !== SystemRole.SYSTEM_ADMIN;
}

export function deletedUserEmail(userId: string) {
  return `deleted-${userId}@deleted.invalid`;
}

export function requiresEmailSecurityReset(currentEmail: string, nextEmail: string) {
  return currentEmail.trim().toLowerCase() !== nextEmail.trim().toLowerCase();
}
