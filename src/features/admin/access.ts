import { SystemRole, type User } from "@prisma/client";

export function isSystemAdministrator(user: Pick<User, "systemRole">) {
  return user.systemRole === SystemRole.SYSTEM_ADMIN;
}
