import { describe, expect, it } from "vitest";
import { isNavigationItemActive } from "./navigation";

describe("app navigation", () => {
  it("marks exact and nested navigation paths active", () => {
    expect(isNavigationItemActive("/notifications", "/notifications")).toBe(true);
    expect(isNavigationItemActive("/admin/users", "/admin")).toBe(true);
  });

  it("does not mark unrelated or similarly prefixed paths active", () => {
    expect(isNavigationItemActive("/profile-settings", "/profile")).toBe(false);
    expect(isNavigationItemActive("/organizations/new/member", "/organizations/new")).toBe(false);
    expect(isNavigationItemActive("/organizations/123", "/dashboard")).toBe(false);
  });
});
