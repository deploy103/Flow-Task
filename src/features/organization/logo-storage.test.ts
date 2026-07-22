import { describe, expect, it } from "vitest";
import { MAX_ORGANIZATION_LOGO_BYTES } from "@/constants/organization";
import { hasValidOrganizationLogoSignature, organizationLogoPath, validateOrganizationLogo } from "./logo-storage";

describe("organization logo storage", () => {
  it("recognizes PNG, JPEG, and WebP signatures", () => {
    expect(hasValidOrganizationLogoSignature(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), "png")).toBe(true);
    expect(hasValidOrganizationLogoSignature(Uint8Array.from([0xff, 0xd8, 0xff]), "jpg")).toBe(true);
    expect(hasValidOrganizationLogoSignature(Uint8Array.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]), "webp")).toBe(true);
    expect(hasValidOrganizationLogoSignature(Uint8Array.from([0x3c, 0x73, 0x76, 0x67]), "png")).toBe(false);
  });

  it("rejects spoofed and oversized uploads", async () => {
    await expect(validateOrganizationLogo(new File(["<svg></svg>"], "logo.png", { type: "image/png" }))).rejects.toThrow("INVALID_LOGO");
    await expect(validateOrganizationLogo(new File([new Uint8Array(MAX_ORGANIZATION_LOGO_BYTES + 1)], "logo.png", { type: "image/png" }))).rejects.toThrow("INVALID_LOGO");
  });

  it("creates an organization-scoped random path", () => {
    expect(organizationLogoPath("org-id", "png")).toMatch(/^org-id\/branding\/[0-9a-f-]{36}\.png$/);
  });
});
