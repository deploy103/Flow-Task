import { describe, expect, it } from "vitest";
import { buildAuthLink, createAuthToken, hashAuthToken } from "./token";

describe("authentication tokens", () => {
  it("creates opaque 256-bit tokens and hashes only the stored value", () => {
    const issued = createAuthToken(60_000, 1_000);
    expect(issued.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(issued.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(issued.expiresAt).toEqual(new Date(61_000));
    expect(issued.tokenHash).not.toContain(issued.token);
  });

  it("rejects malformed token values before hashing", () => {
    expect(hashAuthToken("short")).toBeNull();
    expect(hashAuthToken("a".repeat(42) + "!")).toBeNull();
  });

  it("builds a same-application link with an encoded token", () => {
    const token = "a".repeat(43);
    expect(buildAuthLink("https://flow.mvtp.cloud/base", "/reset-password", token)).toBe(`https://flow.mvtp.cloud/reset-password?token=${token}`);
  });
});
