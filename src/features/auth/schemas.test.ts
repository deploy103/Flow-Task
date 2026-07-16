import { describe, expect, it } from "vitest";
import { loginSchema, signUpSchema } from "./schemas";

describe("auth schemas", () => {
  it("accepts a valid login", () => {
    expect(loginSchema.safeParse({ email: "student@example.com", password: "safe-password" }).success).toBe(true);
  });

  it("rejects malformed email and short password", () => {
    expect(loginSchema.safeParse({ email: "invalid", password: "short" }).success).toBe(false);
  });

  it("normalizes an empty student number", () => {
    const result = signUpSchema.parse({
      email: "student@example.com",
      password: "safe-password",
      name: "김학생",
      studentNumber: "",
    });
    expect(result.studentNumber).toBeUndefined();
  });
});
