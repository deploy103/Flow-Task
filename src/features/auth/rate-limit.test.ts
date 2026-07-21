import { describe, expect, it } from "vitest";
import { resolveAuthRateLimitClientKey } from "./rate-limit";

function requestHeaders(values: Record<string, string>) {
  return { get: (name: string) => values[name.toLowerCase()] ?? null };
}

describe("auth rate limit client key", () => {
  it("ignores spoofable forwarding headers without an explicit trusted proxy", () => {
    const headers = requestHeaders({
      "x-forwarded-for": "203.0.113.10",
      "x-real-ip": "203.0.113.11",
    });

    expect(resolveAuthRateLimitClientKey(headers, "User@Example.com", false)).toBe(
      "identity:user@example.com",
    );
  });

  it("uses only a valid proxy-overwritten real IP when proxy trust is enabled", () => {
    expect(
      resolveAuthRateLimitClientKey(
        requestHeaders({ "x-real-ip": "203.0.113.11" }),
        "user@example.com",
        true,
      ),
    ).toBe("ip:203.0.113.11");
    expect(
      resolveAuthRateLimitClientKey(
        requestHeaders({ "x-real-ip": "not-an-ip", "x-forwarded-for": "203.0.113.10" }),
        "user@example.com",
        true,
      ),
    ).toBe("identity:user@example.com");
  });
});
