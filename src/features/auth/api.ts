import { getCurrentSessionUser } from "@/features/auth/session";

export async function getApiUser() {
  return getCurrentSessionUser();
}
