import { describe, expect, it } from "vitest";
import { SystemRole } from "@prisma/client";
import { isSystemAdministrator } from "./access";

describe("system administrator access", () => {
  it("allows system administrators", () => {
    expect(isSystemAdministrator({ systemRole: SystemRole.SYSTEM_ADMIN })).toBe(true);
  });

  it("rejects regular users", () => {
    expect(isSystemAdministrator({ systemRole: SystemRole.USER })).toBe(false);
  });
});
