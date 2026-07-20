import { NotificationChannel, NotificationDeliveryStatus, OrganizationIntegrationKind } from "@prisma/client";
import webpush from "web-push";
import { decryptIntegrationValue } from "@/features/integration/crypto";
import { validateIntegrationUrl } from "@/features/integration/url-policy";
import { getNotificationDeliveryEnvironment } from "@/lib/env";
import { prisma } from "@/lib/prisma";

export async function queueNotificationDeliveries(userId: string) {
  const preference = await prisma.notificationPreference.findUnique({ where: { userId } });
  if (!preference) return;
  const channels: NotificationChannel[] = [];
  if (preference.emailEnabled) channels.push(NotificationChannel.EMAIL);
  if (preference.webPushEnabled) channels.push(NotificationChannel.WEB_PUSH);
  if (preference.discordEnabled) channels.push(NotificationChannel.DISCORD);
  if (!channels.length) return;
  const notifications = await prisma.notification.findMany({ where: { userId }, select: { id: true }, orderBy: { createdAt: "desc" }, take: 100 });
  await prisma.notificationDelivery.createMany({ data: notifications.flatMap(({ id }) => channels.map((channel) => ({ notificationId: id, channel }))), skipDuplicates: true });
}

function integrationKind(channel: NotificationChannel) {
  if (channel === NotificationChannel.EMAIL) return [OrganizationIntegrationKind.EMAIL_RELAY];
  return [OrganizationIntegrationKind.DISCORD_WEBHOOK, OrganizationIntegrationKind.GENERIC_WEBHOOK];
}

async function deliverExternal(delivery: { channel: NotificationChannel; notification: { title: string; body: string; href: string; organizationId: string | null; user: { email: string } } }) {
  if (!delivery.notification.organizationId) throw new Error("ORGANIZATION_INTEGRATION_UNAVAILABLE");
  const env = getNotificationDeliveryEnvironment();
  const integration = await prisma.organizationIntegration.findFirst({ where: { organizationId: delivery.notification.organizationId, enabled: true, kind: { in: integrationKind(delivery.channel) } }, orderBy: { createdAt: "asc" } });
  if (!integration) throw new Error("ORGANIZATION_INTEGRATION_UNAVAILABLE");
  const endpoint = decryptIntegrationValue(integration.endpointCiphertext, env.INTEGRATION_ENCRYPTION_KEY);
  if (!validateIntegrationUrl(endpoint, integration.kind, env.allowedHosts)) throw new Error("INTEGRATION_ENDPOINT_REJECTED");
  const secret = integration.secretCiphertext ? decryptIntegrationValue(integration.secretCiphertext, env.INTEGRATION_ENCRYPTION_KEY) : null;
  const body = integration.kind === OrganizationIntegrationKind.DISCORD_WEBHOOK ? { content: `**${delivery.notification.title}**\n${delivery.notification.body}\n${delivery.notification.href}` } : integration.kind === OrganizationIntegrationKind.EMAIL_RELAY ? { to: delivery.notification.user.email, subject: delivery.notification.title, text: delivery.notification.body, href: delivery.notification.href } : { event: "notification.created", notification: { title: delivery.notification.title, body: delivery.notification.body, href: delivery.notification.href } };
  const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json", ...(secret ? { Authorization: `Bearer ${secret}` } : {}) }, body: JSON.stringify(body), redirect: "error", signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error(`INTEGRATION_HTTP_${response.status}`);
}

async function deliverWebPush(delivery: { notification: { userId: string; title: string; body: string; href: string } }) {
  const env = getNotificationDeliveryEnvironment();
  webpush.setVapidDetails(env.WEB_PUSH_SUBJECT, env.WEB_PUSH_VAPID_PUBLIC_KEY, env.WEB_PUSH_VAPID_PRIVATE_KEY);
  const subscriptions = await prisma.webPushSubscription.findMany({ where: { userId: delivery.notification.userId } });
  if (!subscriptions.length) throw new Error("WEB_PUSH_SUBSCRIPTION_UNAVAILABLE");
  let sent = 0;
  const href = delivery.notification.href.startsWith("/") && !delivery.notification.href.startsWith("//") ? delivery.notification.href : "/notifications";
  for (const subscription of subscriptions) {
    try { await webpush.sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } }, JSON.stringify({ title: delivery.notification.title, body: delivery.notification.body, href }), { TTL: 300 }); sent += 1; }
    catch (error) { const status = typeof error === "object" && error && "statusCode" in error ? Number(error.statusCode) : 0; if (status === 404 || status === 410) await prisma.webPushSubscription.delete({ where: { id: subscription.id } }).catch(() => undefined); }
  }
  if (!sent) throw new Error("WEB_PUSH_DELIVERY_FAILED");
}

export async function processNotificationDeliveries(now = new Date(), limit = 50) {
  const deliveries = await prisma.notificationDelivery.findMany({ where: { status: NotificationDeliveryStatus.PENDING, attempts: { lt: 5 }, nextAttemptAt: { lte: now } }, select: { id: true, attempts: true, channel: true, notification: { select: { userId: true, organizationId: true, title: true, body: true, href: true, user: { select: { email: true } } } } }, orderBy: { createdAt: "asc" }, take: limit });
  let sent = 0; let failed = 0;
  for (const delivery of deliveries) {
    const attempts = delivery.attempts + 1;
    const claimed = await prisma.notificationDelivery.updateMany({ where: { id: delivery.id, status: NotificationDeliveryStatus.PENDING, attempts: delivery.attempts }, data: { attempts, nextAttemptAt: new Date(now.getTime() + Math.min(60, 2 ** attempts) * 60_000) } });
    if (!claimed.count) continue;
    try {
      if (delivery.channel === NotificationChannel.WEB_PUSH) await deliverWebPush(delivery); else await deliverExternal(delivery);
      await prisma.notificationDelivery.update({ where: { id: delivery.id }, data: { status: NotificationDeliveryStatus.SENT, deliveredAt: new Date(), lastError: null } }); sent += 1;
    } catch (error) {
      const code = error instanceof Error ? error.message.slice(0, 80) : "DELIVERY_FAILED";
      await prisma.notificationDelivery.update({ where: { id: delivery.id }, data: { status: attempts >= 5 ? NotificationDeliveryStatus.FAILED : NotificationDeliveryStatus.PENDING, lastError: code } }); failed += 1;
    }
  }
  return { selected: deliveries.length, sent, failed };
}
