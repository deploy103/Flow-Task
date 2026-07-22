import { OrganizationIntegrationKind } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { INTEGRATION_ERROR_MESSAGES, INTEGRATION_GUIDES, parseIntegrationKind } from "./catalog";

describe("integration setup guide", () => {
  it("provides complete instructions for every supported integration", () => {
    expect(Object.keys(INTEGRATION_GUIDES).sort()).toEqual(Object.values(OrganizationIntegrationKind).sort());
    for (const guide of Object.values(INTEGRATION_GUIDES)) {
      expect(guide.steps.length).toBeGreaterThanOrEqual(3);
      expect(guide.endpointHelp.length).toBeGreaterThan(10);
    }
  });

  it("does not ask Discord users for an unrelated bearer token", () => {
    expect(INTEGRATION_GUIDES.DISCORD_WEBHOOK.usesSecret).toBe(false);
    expect(INTEGRATION_GUIDES.GENERIC_WEBHOOK.usesSecret).toBe(true);
    expect(INTEGRATION_GUIDES.EMAIL_RELAY.usesSecret).toBe(true);
  });

  it("accepts only supported kind query values and has actionable errors", () => {
    expect(parseIntegrationKind("DISCORD_WEBHOOK")).toBe(OrganizationIntegrationKind.DISCORD_WEBHOOK);
    expect(parseIntegrationKind("unknown")).toBeNull();
    for (const code of ["invalid_input", "server_configuration", "invalid_endpoint", "duplicate", "create_failed", "delete_failed"]) {
      expect(INTEGRATION_ERROR_MESSAGES[code].length).toBeGreaterThan(20);
    }
  });
});
