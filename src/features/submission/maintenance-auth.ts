import { timingSafeEqual } from "node:crypto";

export function hasValidMaintenanceAuthorization(
  authorization: string | null,
  expectedSecret: string,
) {
  const prefix = "Bearer ";
  if (!authorization?.startsWith(prefix)) return false;
  const provided = Buffer.from(authorization.slice(prefix.length));
  const expected = Buffer.from(expectedSecret);
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}
