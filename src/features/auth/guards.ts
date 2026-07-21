import { notFound, redirect } from "next/navigation";
import { isSystemAdministrator } from "@/features/admin/access";
import { getCurrentSessionUser } from "./session";

export async function requireAuthenticatedUser() {
  const user = await getCurrentSessionUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireSystemAdministrator() {
  const user = await requireAuthenticatedUser();
  if (!isSystemAdministrator(user)) notFound();
  return user;
}
