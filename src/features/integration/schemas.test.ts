import { OrganizationIntegrationKind } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  MAX_INTEGRATION_ENDPOINT_LENGTH,
  MAX_INTEGRATION_NAME_LENGTH,
  MAX_INTEGRATION_SECRET_LENGTH,
} from "@/constants/integration";
import { createIntegrationSchema } from "./schemas";

const organizationId = "550e8400-e29b-41d4-a716-446655440000";
const validInput = {
  organizationId,
  kind: OrganizationIntegrationKind.DISCORD_WEBHOOK,
  name: "공지 알림",
  endpoint: "https://discord.com/api/webhooks/1/token",
  secret: "",
};

describe("integration form schema", () => {
  it("accepts a supported integration with valid fields", () => {
    expect(createIntegrationSchema.safeParse(validInput).success).toBe(true);
  });

  it("rejects unsupported kinds and oversized values", () => {
    expect(createIntegrationSchema.safeParse({ ...validInput, kind: "UNKNOWN" }).success).toBe(false);
    expect(createIntegrationSchema.safeParse({ ...validInput, name: "a".repeat(MAX_INTEGRATION_NAME_LENGTH + 1) }).success).toBe(false);
    expect(createIntegrationSchema.safeParse({ ...validInput, endpoint: `https://example.com/${"a".repeat(MAX_INTEGRATION_ENDPOINT_LENGTH)}` }).success).toBe(false);
    expect(createIntegrationSchema.safeParse({ ...validInput, secret: "a".repeat(MAX_INTEGRATION_SECRET_LENGTH + 1) }).success).toBe(false);
  });

  it("rejects malformed organization IDs and non-URL endpoints", () => {
    expect(createIntegrationSchema.safeParse({ ...validInput, organizationId: "other" }).success).toBe(false);
    expect(createIntegrationSchema.safeParse({ ...validInput, endpoint: "not-a-url" }).success).toBe(false);
  });
});
