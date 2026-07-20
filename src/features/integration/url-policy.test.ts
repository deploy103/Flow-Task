import { OrganizationIntegrationKind } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { validateIntegrationUrl } from "./url-policy";

describe("outbound integration URL policy", () => {
  it("accepts only the Discord webhook HTTPS path", () => {
    expect(validateIntegrationUrl("https://discord.com/api/webhooks/1/token", OrganizationIntegrationKind.DISCORD_WEBHOOK, [])).toBeTruthy();
    expect(validateIntegrationUrl("https://discord.com/channels/1", OrganizationIntegrationKind.DISCORD_WEBHOOK, [])).toBeNull();
  });
  it("requires an explicit host allowlist and blocks credentials or local targets", () => {
    expect(validateIntegrationUrl("https://relay.example.com/v1/send", OrganizationIntegrationKind.EMAIL_RELAY, ["relay.example.com"])).toBeTruthy();
    expect(validateIntegrationUrl("https://relay.example.com/v1/send", OrganizationIntegrationKind.EMAIL_RELAY, [])).toBeNull();
    expect(validateIntegrationUrl("https://user:pass@relay.example.com/v1/send", OrganizationIntegrationKind.EMAIL_RELAY, ["relay.example.com"])).toBeNull();
    expect(validateIntegrationUrl("https://127.0.0.1/hook", OrganizationIntegrationKind.GENERIC_WEBHOOK, ["127.0.0.1"])).toBeNull();
  });
});
