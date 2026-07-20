"use server";

import { revalidatePath } from "next/cache";
import { requireAuthenticatedUser } from "@/features/auth/guards";
import { prisma } from "@/lib/prisma";

const enabled = (value: FormDataEntryValue | null) => value === "on";

export async function updateNotificationPreference(formData: FormData) {
  const user = await requireAuthenticatedUser();
  await prisma.notificationPreference.upsert({ where: { userId: user.id }, create: { userId: user.id, emailEnabled: enabled(formData.get("emailEnabled")), webPushEnabled: enabled(formData.get("webPushEnabled")), discordEnabled: enabled(formData.get("discordEnabled")) }, update: { emailEnabled: enabled(formData.get("emailEnabled")), webPushEnabled: enabled(formData.get("webPushEnabled")), discordEnabled: enabled(formData.get("discordEnabled")) } });
  if (!enabled(formData.get("webPushEnabled"))) await prisma.webPushSubscription.deleteMany({ where: { userId: user.id } });
  revalidatePath("/notifications");
}
