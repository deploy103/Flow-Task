import { createHash } from "node:crypto";
import { isIP } from "node:net";
import { Prisma } from "@prisma/client";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";

const policies = {
  LOGIN: {
    windowMilliseconds: 15 * 60 * 1_000,
    accountAttempts: 10,
    ipAttempts: 20,
    globalAttempts: 200,
  },
  SIGNUP: {
    windowMilliseconds: 60 * 60 * 1_000,
    accountAttempts: 5,
    ipAttempts: 10,
    globalAttempts: 100,
  },
  VERIFY: {
    windowMilliseconds: 60 * 60 * 1_000,
    accountAttempts: 3,
    ipAttempts: 10,
    globalAttempts: 100,
  },
  RESET: {
    windowMilliseconds: 60 * 60 * 1_000,
    accountAttempts: 3,
    ipAttempts: 10,
    globalAttempts: 100,
  },
} as const;
const RATE_LIMIT_RETENTION_MILLISECONDS = 2 * 60 * 60 * 1_000;
const UNTRUSTED_DIRECT_SOURCE_KEY = "source:untrusted-direct";
const GLOBAL_SOURCE_KEY = "global:all-clients";

export type AuthRateLimitAction = keyof typeof policies;

type AuthRateLimitCounter = {
  action: string;
  clientKey: string;
  attempts: number;
  windowMilliseconds: number;
};

export function resolveAuthRateLimitSourceKey(
  requestHeaders: { get(name: string): string | null },
  trustProxy = process.env.AUTH_TRUST_PROXY === "true",
) {
  if (trustProxy) {
    const proxyAddress = requestHeaders.get("x-real-ip")?.trim();
    if (proxyAddress && isIP(proxyAddress)) return `source:${proxyAddress}`;
  }
  return UNTRUSTED_DIRECT_SOURCE_KEY;
}

export function getAuthRateLimitKeyHash(clientKey: string) {
  return createHash("sha256").update(clientKey, "utf8").digest("hex");
}

export function getAuthRateLimitCounters(
  action: AuthRateLimitAction,
  identity: string,
  sourceKey: string,
) {
  const policy = policies[action];
  return {
    ip: {
      action: `${action}_IP`,
      clientKey: sourceKey,
      attempts: policy.ipAttempts,
      windowMilliseconds: policy.windowMilliseconds,
    },
    global: {
      action: `${action}_GLOBAL`,
      clientKey: GLOBAL_SOURCE_KEY,
      attempts: policy.globalAttempts,
      windowMilliseconds: policy.windowMilliseconds,
    },
    account: {
      action: `${action}_ACCOUNT`,
      clientKey: `account:${identity.trim().toLowerCase()}`,
      attempts: policy.accountAttempts,
      windowMilliseconds: policy.windowMilliseconds,
    },
  } satisfies Record<string, AuthRateLimitCounter>;
}

async function consumeAuthRateLimitCounter(counter: AuthRateLimitCounter, now: Date) {
  const keyHash = getAuthRateLimitKeyHash(counter.clientKey);
  const windowBoundary = new Date(now.getTime() - counter.windowMilliseconds);
  const consumed = await prisma.$queryRaw<Array<{ allowed: boolean }>>(Prisma.sql`
    INSERT INTO "auth_rate_limits" (
      "key_hash", "action", "attempts", "window_started_at", "updated_at"
    ) VALUES (
      ${keyHash}, ${counter.action}, 1, ${now}, ${now}
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
      OR "auth_rate_limits"."attempts" < ${counter.attempts}
    RETURNING TRUE AS "allowed"
  `);
  return consumed.length === 1;
}

export async function consumeAuthAttemptsForContext(
  action: AuthRateLimitAction,
  identity: string,
  sourceKey: string,
  now = new Date(),
) {
  const cleanupBoundary = new Date(now.getTime() - RATE_LIMIT_RETENTION_MILLISECONDS);
  await prisma.authRateLimit.deleteMany({ where: { updatedAt: { lte: cleanupBoundary } } });

  const counters = getAuthRateLimitCounters(action, identity, sourceKey);
  if (!(await consumeAuthRateLimitCounter(counters.global, now))) return false;
  if (!(await consumeAuthRateLimitCounter(counters.ip, now))) return false;
  return consumeAuthRateLimitCounter(counters.account, now);
}

export async function consumeAuthAttempt(action: AuthRateLimitAction, identity: string) {
  const requestHeaders = await headers();
  return consumeAuthAttemptsForContext(
    action,
    identity,
    resolveAuthRateLimitSourceKey(requestHeaders),
  );
}
