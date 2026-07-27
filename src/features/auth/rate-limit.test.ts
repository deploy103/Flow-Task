import { describe, expect, it } from "vitest";
import {
  EMAIL_DELIVERY_COOLDOWN_MILLISECONDS,
  getEmailDeliveryCooldownCounter,
  getAuthRateLimitCounters,
  resolveAuthRateLimitSourceKey,
} from "./rate-limit";

function requestHeaders(values: Record<string, string>) {
  return { get: (name: string) => values[name.toLowerCase()] ?? null };
}

describe("auth rate limit keys", () => {
  it("ignores spoofable forwarding headers without an explicit trusted proxy", () => {
    const headers = requestHeaders({
      "x-forwarded-for": "203.0.113.10",
      "x-real-ip": "203.0.113.11",
    });

    expect(resolveAuthRateLimitSourceKey(headers, false)).toBe("source:untrusted-direct");
  });

  it("uses only a valid proxy-overwritten real IP when proxy trust is enabled", () => {
    expect(
      resolveAuthRateLimitSourceKey(
        requestHeaders({ "x-real-ip": "203.0.113.11" }),
        true,
      ),
    ).toBe("source:203.0.113.11");
    expect(
      resolveAuthRateLimitSourceKey(
        requestHeaders({ "x-real-ip": "not-an-ip", "x-forwarded-for": "203.0.113.10" }),
        true,
      ),
    ).toBe("source:untrusted-direct");
  });

  it("always creates separate source, account, and global counters", () => {
    const counters = getAuthRateLimitCounters(
      "LOGIN",
      " User@Example.com ",
      "source:203.0.113.11",
    );

    expect(counters.ip.clientKey).toBe("source:203.0.113.11");
    expect(counters.account.clientKey).toBe("account:user@example.com");
    expect(counters.global.clientKey).toBe("global:all-clients");
    expect(new Set(Object.values(counters).map(({ action }) => action))).toHaveLength(3);
  });

  it("limits authenticated password verification attempts separately", () => {
    const counters = getAuthRateLimitCounters(
      "PASSWORD",
      " User@Example.com ",
      "source:203.0.113.11",
    );

    expect(counters.account).toMatchObject({ action: "PASSWORD_ACCOUNT", attempts: 5 });
    expect(counters.ip).toMatchObject({ action: "PASSWORD_IP", attempts: 10 });
    expect(counters.global.action).toBe("PASSWORD_GLOBAL");
  });

  it("uses a normalized purpose-specific five-minute email counter", () => {
    const verification = getEmailDeliveryCooldownCounter("VERIFY", " User@Example.com ");
    const reset = getEmailDeliveryCooldownCounter("RESET", " User@Example.com ");

    expect(verification).toMatchObject({
      action: "MAIL_VERIFY_5M",
      clientKey: "account:user@example.com",
      attempts: 1,
      windowMilliseconds: EMAIL_DELIVERY_COOLDOWN_MILLISECONDS,
    });
    expect(reset.action).toBe("MAIL_RESET_5M");
    expect(verification.action.length).toBeLessThanOrEqual(20);
    expect(reset.action.length).toBeLessThanOrEqual(20);
  });
});
