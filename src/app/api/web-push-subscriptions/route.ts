import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthenticatedUser } from "@/features/auth/guards";
import { canUsePushEndpoint, isAllowedPushEndpoint } from "@/features/notification/push-policy";
import { prisma } from "@/lib/prisma";
import { hasTrustedMutationOrigin, readBoundedJson } from "@/lib/request-security";

const schema = z.object({ endpoint: z.url().max(2048), keys: z.object({ p256dh: z.string().min(40).max(180), auth: z.string().min(10).max(80) }) });

export async function POST(request: Request) {
  if (!hasTrustedMutationOrigin(request)) return NextResponse.json({ error: "forbidden_origin" }, { status: 403 });
  const body = await readBoundedJson(request, 4_096);
  if (!body.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  const parsed = schema.safeParse(body.data);
  if (!parsed.success || !isAllowedPushEndpoint(parsed.data.endpoint)) return NextResponse.json({ error: "invalid_subscription" }, { status: 400 });
  const user = await requireAuthenticatedUser();
  const endpointHash = createHash("sha256").update(parsed.data.endpoint).digest("hex");
  try {
    await prisma.$transaction(async (transaction) => {
      const existing = await transaction.webPushSubscription.findUnique({ where: { endpointHash }, select: { id: true, userId: true } });
      if (!canUsePushEndpoint(existing?.userId ?? null, user.id)) throw new Error("SUBSCRIPTION_OWNED_BY_ANOTHER_USER");
      if (existing) await transaction.webPushSubscription.update({ where: { id: existing.id }, data: { endpoint: parsed.data.endpoint, p256dh: parsed.data.keys.p256dh, auth: parsed.data.keys.auth, lastUsedAt: new Date() } });
      else await transaction.webPushSubscription.create({ data: { userId: user.id, endpoint: parsed.data.endpoint, endpointHash, p256dh: parsed.data.keys.p256dh, auth: parsed.data.keys.auth } });
      await transaction.notificationPreference.upsert({ where: { userId: user.id }, create: { userId: user.id, webPushEnabled: true }, update: { webPushEnabled: true } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch { return NextResponse.json({ error: "subscription_conflict" }, { status: 409 }); }
  return NextResponse.json({ success: true });
}
