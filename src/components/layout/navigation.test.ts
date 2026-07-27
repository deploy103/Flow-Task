import { describe, expect, it } from "vitest";
import {
  getOrganizationIdFromPathname,
  isNavigationItemActive,
  isOrganizationNavigationItemActive,
} from "./navigation";

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

  it("extracts only existing organization routes", () => {
    expect(getOrganizationIdFromPathname("/organizations/club-1/assignments")).toBe("club-1");
    expect(getOrganizationIdFromPathname("/organizations/new")).toBeNull();
    expect(getOrganizationIdFromPathname("/dashboard")).toBeNull();
  });

  it("marks organization sections without making the overview active everywhere", () => {
    const overview = "/organizations/club-1";
    const assignments = `${overview}/assignments`;

    expect(isOrganizationNavigationItemActive(overview, overview)).toBe(true);
    expect(isOrganizationNavigationItemActive(`${assignments}/assignment-1`, assignments)).toBe(true);
    expect(isOrganizationNavigationItemActive(assignments, overview)).toBe(false);
    expect(isOrganizationNavigationItemActive("/organizations/club-2/assignments", assignments)).toBe(false);
  });
});
