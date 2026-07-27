import { describe, expect, it } from "vitest";
import { parseAdminAuditQuery } from "./audit-query";

describe("admin audit query", () => {
  it("normalizes valid filters and page", () => {
    expect(parseAdminAuditQuery({ q: "  admin  ", action: "SYSTEM_USER_UPDATED", page: "3" })).toEqual({
      q: "admin",
      action: "SYSTEM_USER_UPDATED",
      page: 3,
    });
  });

  it("falls back safely for invalid or oversized input", () => {
    expect(parseAdminAuditQuery({ organizationId: "not-a-uuid", q: "x".repeat(101), page: "-1" })).toEqual({
      q: undefined,
      action: undefined,
      targetType: undefined,
      organizationId: undefined,
      page: 1,
    });
  });

  it("uses only the first value of repeated query fields", () => {
    expect(parseAdminAuditQuery({ targetType: ["USER", "ORGANIZATION"], page: ["2", "9"] })).toEqual({ targetType: "USER", page: 2 });
  });
});
