import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password";

describe("local password hashing", () => {
  it("verifies the correct password without storing it", async () => {
    const encoded = await hashPassword("correct horse battery staple");
    expect(encoded).not.toContain("correct horse battery staple");
    await expect(verifyPassword("correct horse battery staple", encoded)).resolves.toBe(true);
    await expect(verifyPassword("wrong password", encoded)).resolves.toBe(false);
  });

  it("uses a unique random salt", async () => {
    const first = await hashPassword("same password");
    const second = await hashPassword("same password");
    expect(first).not.toBe(second);
  });

  it("rejects malformed hashes", async () => {
    await expect(verifyPassword("password", "invalid")).resolves.toBe(false);
  });
});
