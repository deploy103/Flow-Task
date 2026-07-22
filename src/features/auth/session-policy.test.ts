import { describe, expect, it } from "vitest";
import { getSessionCookieName, sessionCookieOptions } from "./session";

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
});
