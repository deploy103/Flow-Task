import { createHash } from "node:crypto";
import { isIP } from "node:net";
import { Prisma } from "@prisma/client";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";

const policies = {
  LOGIN: { attempts: 10, windowMilliseconds: 15 * 60 * 1_000 },
  SIGNUP: { attempts: 5, windowMilliseconds: 60 * 60 * 1_000 },
} as const;
const RATE_LIMIT_RETENTION_MILLISECONDS = 2 * 60 * 60 * 1_000;

export type AuthRateLimitAction = keyof typeof policies;

export function resolveAuthRateLimitClientKey(
  requestHeaders: { get(name: string): string | null },
  identity: string,
  trustProxy = process.env.AUTH_TRUST_PROXY === "true",
) {
  if (trustProxy) {
    const proxyAddress = requestHeaders.get("x-real-ip")?.trim();
    if (proxyAddress && isIP(proxyAddress)) return `ip:${proxyAddress}`;
  }
  return `identity:${identity.trim().toLowerCase()}`;
}

function hashClientKey(clientKey: string) {
  return createHash("sha256").update(clientKey, "utf8").digest("hex");
}

export async function consumeAuthAttemptForKey(
  action: AuthRateLimitAction,
  clientKey: string,
  now = new Date(),
) {
  const policy = policies[action];
  const keyHash = hashClientKey(clientKey);
  const windowBoundary = new Date(now.getTime() - policy.windowMilliseconds);
  const cleanupBoundary = new Date(now.getTime() - RATE_LIMIT_RETENTION_MILLISECONDS);

  await prisma.authRateLimit.deleteMany({ where: { updatedAt: { lte: cleanupBoundary } } });
  const consumed = await prisma.$queryRaw<Array<{ allowed: boolean }>>(Prisma.sql`
    INSERT INTO "auth_rate_limits" (
      "key_hash", "action", "attempts", "window_started_at", "updated_at"
    ) VALUES (
      ${keyHash}, ${action}, 1, ${now}, ${now}
    )
    ON CONFLICT ("key_hash", "action") DO UPDATE SET
      "attempts" = CASE
        WHEN "auth_rate_limits"."window_started_at" <= ${windowBoundary} THEN 1
        ELSE "auth_rate_limits"."attempts" + 1
      END,
      "window_started_at" = CASE
        WHEN "auth_rate_limits"."window_started_at" <= ${windowBoundary} THEN ${now}
        ELSE "auth_rate_limits"."window_started_at"
      END,
      "updated_at" = ${now}
    WHERE
      "auth_rate_limits"."window_started_at" <= ${windowBoundary}
      OR "auth_rate_limits"."attempts" < ${policy.attempts}
    RETURNING TRUE AS "allowed"
  `);
  return consumed.length === 1;
}

export async function consumeAuthAttempt(action: AuthRateLimitAction, identity: string) {
  const requestHeaders = await headers();
  return consumeAuthAttemptForKey(
    action,
    resolveAuthRateLimitClientKey(requestHeaders, identity),
  );
}
