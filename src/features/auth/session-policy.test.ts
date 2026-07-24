import { describe, expect, it } from "vitest";
import { getSessionCookieName, getSessionExpiration, sessionCookieOptions } from "./session";

describe("session cookie policy", () => {
  it("uses the host-only prefix and secure attributes in production", () => {
    expect(getSessionCookieName(true)).toBe("__Host-flow_task_session");
    expect(sessionCookieOptions(new Date(0), true)).toMatchObject({ httpOnly: true, sameSite: "lax", secure: true, path: "/", priority: "high" });
    expect(sessionCookieOptions(new Date(0), true)).not.toHaveProperty("domain");
  });

  it("keeps local HTTP development usable", () => {
    expect(getSessionCookieName(false)).toBe("flow_task_session");
    expect(sessionCookieOptions(new Date(0), false).secure).toBe(false);
  });

  it("uses a session cookie unless persistent login is selected", () => {
    expect(sessionCookieOptions(undefined, true)).not.toHaveProperty("expires");
    expect(sessionCookieOptions(new Date(123), true).expires).toEqual(new Date(123));
  });

  it("limits browser and persistent server sessions", () => {
    expect(getSessionExpiration(false, 0)).toEqual(new Date(24 * 60 * 60 * 1_000));
    expect(getSessionExpiration(true, 0)).toEqual(new Date(30 * 24 * 60 * 60 * 1_000));
  });
});
