import { describe, expect, it } from "vitest";
import { getSecurityHeaders } from "./security-headers";

describe("global security headers", () => {
  it("locks framing, MIME handling, browser capabilities and CSP", () => {
    const headers = Object.fromEntries(getSecurityHeaders(true).map(({ key, value }) => [key, value]));
    expect(headers["Content-Security-Policy"]).toContain("default-src 'self'");
    expect(headers["Content-Security-Policy"]).toContain("object-src 'none'");
    expect(headers["Content-Security-Policy"]).toContain("frame-ancestors 'none'");
    expect(headers["Content-Security-Policy"]).toContain("form-action 'self'");
    expect(headers["X-Frame-Options"]).toBe("DENY");
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(headers["Permissions-Policy"]).toContain("camera=()");
  });

  it("enables HSTS and HTTPS upgrades only in production", () => {
    expect(getSecurityHeaders(true).some(({ key }) => key === "Strict-Transport-Security")).toBe(true);
    expect(getSecurityHeaders(false).some(({ key }) => key === "Strict-Transport-Security")).toBe(false);
    expect(getSecurityHeaders(false).find(({ key }) => key === "Content-Security-Policy")?.value).not.toContain("upgrade-insecure-requests");
  });
});
