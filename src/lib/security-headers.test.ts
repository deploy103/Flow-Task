import { describe, expect, it } from "vitest";
import { getSecurityHeaders } from "./security-headers";

describe("global security headers", () => {
  it("locks framing, MIME handling, browser capabilities and origins", () => {
    const headers = Object.fromEntries(getSecurityHeaders(true).map(({ key, value }) => [key, value]));
    expect(headers["X-Frame-Options"]).toBe("DENY");
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(headers["Permissions-Policy"]).toContain("camera=()");
    expect(headers["Cross-Origin-Resource-Policy"]).toBe("same-origin");
    expect(headers["Origin-Agent-Cluster"]).toBe("?1");
  });

  it("enables HSTS only in production", () => {
    expect(getSecurityHeaders(true).some(({ key }) => key === "Strict-Transport-Security")).toBe(true);
    expect(getSecurityHeaders(false).some(({ key }) => key === "Strict-Transport-Security")).toBe(false);
  });
});
