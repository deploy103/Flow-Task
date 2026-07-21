import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";

const policies = {
  LOGIN: { attempts: 10, windowMilliseconds: 15 * 60 * 1_000 },
  SIGNUP: { attempts: 5, windowMilliseconds: 60 * 60 * 1_000 },
} as const;

export async function consumeAuthAttempt(action: keyof typeof policies) {
  const requestHeaders = await headers();
  const address = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? requestHeaders.get("x-real-ip")?.trim()
    ?? "unknown";
  const keyHash = createHash("sha256").update(address, "utf8").digest("hex");
  const policy = policies[action];
  const now = new Date();
  const windowBoundary = new Date(now.getTime() - policy.windowMilliseconds);

  return prisma.$transaction(async (transaction) => {
    const existing = await transaction.authRateLimit.findUnique({
      where: { keyHash_action: { keyHash, action } },
    });
    if (!existing || existing.windowStartedAt <= windowBoundary) {
      await transaction.authRateLimit.upsert({
        where: { keyHash_action: { keyHash, action } },
        create: { keyHash, action, attempts: 1, windowStartedAt: now },
        update: { attempts: 1, windowStartedAt: now },
      });
      return true;
    }
    if (existing.attempts >= policy.attempts) return false;
    await transaction.authRateLimit.update({
      where: { keyHash_action: { keyHash, action } },
      data: { attempts: { increment: 1 } },
    });
    return true;
  });
}
