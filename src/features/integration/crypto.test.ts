import { describe, expect, it } from "vitest";
import { decryptIntegrationValue, encryptIntegrationValue } from "./crypto";

describe("integration secret encryption", () => {
  it("round trips with random authenticated ciphertext", () => {
    const key = "integration-test-key-value-at-least-32-characters";
    const first = encryptIntegrationValue("https://hooks.example.com/secret", key);
    const second = encryptIntegrationValue("https://hooks.example.com/secret", key);
    expect(first).not.toBe(second);
    expect(first).not.toContain("hooks.example.com");
    expect(decryptIntegrationValue(first, key)).toBe("https://hooks.example.com/secret");
  });
  it("rejects tampering and weak keys", () => {
    expect(() => encryptIntegrationValue("secret", "short")).toThrow(/KEY/);
    expect(() => decryptIntegrationValue("v1.invalid.invalid.invalid", "integration-test-key-value-at-least-32-characters")).toThrow();
  });
});
