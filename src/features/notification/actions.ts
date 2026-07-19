"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAuthenticatedUser } from "@/features/auth/guards";
import { prisma } from "@/lib/prisma";
import { notificationReferenceSchema } from "./schemas";

export async function markNotificationRead(formData: FormData) {
  const parsed = notificationReferenceSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/notifications?error=invalid_notification");
  const user = await requireAuthenticatedUser();
  await prisma.notification.updateMany({
    where: { id: parsed.data.notificationId, userId: user.id, readAt: null },
    data: { readAt: new Date() },
  });
  revalidatePath("/notifications");
}

export async function markAllNotificationsRead() {
  const user = await requireAuthenticatedUser();
  await prisma.notification.updateMany({
    where: { userId: user.id, readAt: null },
    data: { readAt: new Date() },
  });
  revalidatePath("/notifications");
}
