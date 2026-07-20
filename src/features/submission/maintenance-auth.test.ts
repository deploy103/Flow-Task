import { describe, expect, it } from "vitest";
import { hasValidMaintenanceAuthorization } from "./maintenance-auth";

const secret = "maintenance-secret-value-at-least-32-characters";

describe("submission cleanup authorization", () => {
  it("accepts only an exact bearer secret", () => {
    expect(hasValidMaintenanceAuthorization(`Bearer ${secret}`, secret)).toBe(true);
    expect(hasValidMaintenanceAuthorization("Bearer wrong", secret)).toBe(false);
    expect(hasValidMaintenanceAuthorization(null, secret)).toBe(false);
  });
});
