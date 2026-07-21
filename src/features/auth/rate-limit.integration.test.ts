import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { consumeAuthAttemptForKey } from "./rate-limit";

const describeWithDatabase = process.env.RUN_DATABASE_TESTS === "1" ? describe : describe.skip;

describeWithDatabase("auth rate limit database concurrency", () => {
  const clientKey = `integration:${randomUUID()}`;

  afterAll(async () => {
    await prisma.authRateLimit.deleteMany();
    await prisma.$disconnect();
  });

  it("allows exactly the policy limit under concurrent requests", async () => {
    const results = await Promise.all(
      Array.from({ length: 25 }, () => consumeAuthAttemptForKey("LOGIN", clientKey)),
    );

    expect(results.filter(Boolean)).toHaveLength(10);
    const rows = await prisma.authRateLimit.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.attempts).toBe(10);
  });

  it("removes expired rows while consuming a new attempt", async () => {
    await prisma.authRateLimit.updateMany({
      data: { updatedAt: new Date("2000-01-01T00:00:00.000Z") },
    });

    await expect(
      consumeAuthAttemptForKey("SIGNUP", `cleanup:${randomUUID()}`),
    ).resolves.toBe(true);
    const rows = await prisma.authRateLimit.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.action).toBe("SIGNUP");
  });
});
