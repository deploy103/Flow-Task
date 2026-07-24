import { describe, expect, it } from "vitest";
import { emailRequestSchema, loginSchema, passwordResetSchema, profileSchema, signUpSchema, verificationTokenSchema } from "./schemas";

describe("auth schemas", () => {
  it("accepts a valid login", () => {
    expect(loginSchema.parse({ email: "student@example.com", password: "safe-password" }).rememberMe).toBe(false);
    expect(loginSchema.parse({ email: "student@example.com", password: "safe-password", rememberMe: "on" }).rememberMe).toBe(true);
  });

  it("rejects malformed email and short password", () => {
    expect(loginSchema.safeParse({ email: "invalid", password: "short" }).success).toBe(false);
  });

  it("normalizes an empty student number", () => {
    const result = signUpSchema.parse({
      email: "student@example.com",
      password: "safe-password",
      passwordConfirmation: "safe-password",
      name: "김학생",
      birthDate: "2008-03-01",
      privacyConsent: "on",
      studentNumber: "",
    });
    expect(result.studentNumber).toBeUndefined();
  });

  it("rejects invalid birth dates and mismatched signup passwords", () => {
    const valid = {
      email: "student@example.com",
      password: "safe-password",
      passwordConfirmation: "safe-password",
      name: "김학생",
      birthDate: "2008-03-01",
      privacyConsent: "on",
      studentNumber: "",
    };
    expect(signUpSchema.safeParse({ ...valid, birthDate: "2008-02-30" }).success).toBe(false);
    expect(signUpSchema.safeParse({ ...valid, birthDate: "2999-01-01" }).success).toBe(false);
    expect(signUpSchema.safeParse({ ...valid, passwordConfirmation: "other-password" }).success).toBe(false);
    expect(signUpSchema.safeParse({ ...valid, privacyConsent: undefined }).success).toBe(false);
    expect(signUpSchema.safeParse({ ...valid, birthDate: "2020-01-01" }).success).toBe(false);
  });

  it("allows a legacy profile update without collecting a birth date", () => {
    expect(profileSchema.safeParse({ name: "기존 사용자", studentNumber: "", birthDate: "" }).success).toBe(true);
  });

  it("validates password reset confirmation and token shape", () => {
    const token = "a".repeat(43);
    expect(passwordResetSchema.safeParse({ token, password: "new-password", passwordConfirmation: "new-password" }).success).toBe(true);
    expect(passwordResetSchema.safeParse({ token, password: "new-password", passwordConfirmation: "different-password" }).success).toBe(false);
    expect(passwordResetSchema.safeParse({ token: "short", password: "new-password", passwordConfirmation: "new-password" }).success).toBe(false);
  });

  it("normalizes email requests through validation", () => {
    expect(emailRequestSchema.parse({ email: "  Student@Example.com " }).email).toBe("Student@Example.com");
  });

  it("accepts only an opaque verification token", () => {
    expect(verificationTokenSchema.safeParse({ token: "a".repeat(43) }).success).toBe(true);
    expect(verificationTokenSchema.safeParse({ token: "a".repeat(42) }).success).toBe(false);
  });
});
