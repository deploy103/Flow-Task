import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  consumeAuthAttemptsForContext,
  consumeEmailDeliveryCooldownForContext,
  EMAIL_DELIVERY_COOLDOWN_MILLISECONDS,
  getEmailDeliveryCooldownCounter,
  getAuthRateLimitCounters,
  getAuthRateLimitKeyHash,
  type AuthRateLimitAction,
} from "./rate-limit";

const describeWithDatabase = process.env.RUN_DATABASE_TESTS === "1" ? describe : describe.skip;

describeWithDatabase("auth rate limit database concurrency", () => {
  const trackedKeyHashes = new Set<string>();

  function trackCounters(action: AuthRateLimitAction, identity: string, sourceKey: string) {
    for (const counter of Object.values(getAuthRateLimitCounters(action, identity, sourceKey))) {
      trackedKeyHashes.add(getAuthRateLimitKeyHash(counter.clientKey));
    }
  }

  async function consume(action: AuthRateLimitAction, identity: string, sourceKey: string) {
    trackCounters(action, identity, sourceKey);
    return consumeAuthAttemptsForContext(action, identity, sourceKey);
  }

  async function consumeEmail(identity: string, now: Date) {
    const counter = getEmailDeliveryCooldownCounter("VERIFY", identity);
    trackedKeyHashes.add(getAuthRateLimitKeyHash(counter.clientKey));
    return consumeEmailDeliveryCooldownForContext("VERIFY", identity, now);
  }

  beforeAll(async () => {
    if (process.env.RUN_DATABASE_TESTS !== "1") throw new Error("Database tests must be explicit.");
    const [database] = await prisma.$queryRaw<Array<{ name: string }>>`
      SELECT current_database() AS "name"
    `;
    if (!database?.name.endsWith("_test")) {
      throw new Error("Auth rate-limit integration tests require a *_test database.");
    }
  });

  beforeEach(async () => {
    if (!trackedKeyHashes.size) return;
    await prisma.authRateLimit.deleteMany({
      where: { keyHash: { in: [...trackedKeyHashes] } },
    });
    trackedKeyHashes.clear();
  });

  afterAll(async () => {
    await prisma.authRateLimit.deleteMany({
      where: { keyHash: { in: [...trackedKeyHashes] } },
    });
    await prisma.$disconnect();
  });

  it("limits concurrent requests for one account", async () => {
    const identity = `account-${randomUUID()}@example.com`;
    const sourceKey = `source:${randomUUID()}`;
    const results = await Promise.all(
      Array.from({ length: 25 }, () => consume("LOGIN", identity, sourceKey)),
    );

    expect(results.filter(Boolean)).toHaveLength(10);
  });

  it("allows one email per five minutes even under concurrency", async () => {
    const identity = `mail-${randomUUID()}@example.com`;
    const now = new Date("2026-07-24T00:00:00.000Z");
    const results = await Promise.all(Array.from({ length: 20 }, () => consumeEmail(identity, now)));

    expect(results.filter(Boolean)).toHaveLength(1);
    await expect(consumeEmail(identity, new Date(now.getTime() + EMAIL_DELIVERY_COOLDOWN_MILLISECONDS - 1))).resolves.toBe(false);
    await expect(consumeEmail(identity, new Date(now.getTime() + EMAIL_DELIVERY_COOLDOWN_MILLISECONDS))).resolves.toBe(true);
  });

  it("limits consecutive unique accounts from one source", async () => {
    const sourceKey = `source:${randomUUID()}`;
    const results = [];
    for (let index = 0; index < 25; index += 1) {
      results.push(await consume("LOGIN", `unique-${randomUUID()}@example.com`, sourceKey));
    }

    expect(results.filter(Boolean)).toHaveLength(20);
  });

  it("limits one account across multiple sources", async () => {
    const identity = `distributed-${randomUUID()}@example.com`;
    const results = [];
    for (let index = 0; index < 25; index += 1) {
      results.push(await consume("LOGIN", identity, `source:${randomUUID()}`));
    }

    expect(results.filter(Boolean)).toHaveLength(10);
  });

  it("enforces the global limit across unique accounts and sources", async () => {
    const results = [];
    for (let index = 0; index < 120; index += 1) {
      results.push(
        await consume(
          "SIGNUP",
          `global-${randomUUID()}@example.com`,
          `source:${randomUUID()}`,
        ),
      );
    }

    expect(results.filter(Boolean)).toHaveLength(100);
  });

  it("removes only expired rows while consuming a new attempt", async () => {
    const expiredIdentity = `expired-${randomUUID()}@example.com`;
    const expiredSource = `source:${randomUUID()}`;
    await consume("SIGNUP", expiredIdentity, expiredSource);
    const expiredCounters = getAuthRateLimitCounters("SIGNUP", expiredIdentity, expiredSource);
    const expiredHashes = Object.values(expiredCounters).map(({ clientKey }) =>
      getAuthRateLimitKeyHash(clientKey),
    );
    const expiredUniqueHashes = [expiredCounters.ip, expiredCounters.account].map(
      ({ clientKey }) => getAuthRateLimitKeyHash(clientKey),
    );
    await prisma.authRateLimit.updateMany({
      where: { keyHash: { in: expiredHashes } },
      data: { updatedAt: new Date("2000-01-01T00:00:00.000Z") },
    });

    await expect(
      consume("SIGNUP", `cleanup-${randomUUID()}@example.com`, `source:${randomUUID()}`),
    ).resolves.toBe(true);
    await expect(
      prisma.authRateLimit.count({ where: { keyHash: { in: expiredUniqueHashes } } }),
    ).resolves.toBe(0);
  });
});
