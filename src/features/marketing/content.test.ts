import { describe, expect, it } from "vitest";
import { MARKETING_FEATURES, MARKETING_STEPS, PUBLIC_APP_ORIGIN, PUBLIC_LOGIN_URL, PUBLIC_SIGNUP_URL } from "./content";

describe("public marketing content", () => {
  it("uses the production Flow Task origin for primary actions", () => {
    expect(PUBLIC_APP_ORIGIN).toBe("https://flow.mvtp.cloud");
    expect(PUBLIC_LOGIN_URL).toBe("https://flow.mvtp.cloud/login");
    expect(PUBLIC_SIGNUP_URL).toBe("https://flow.mvtp.cloud/signup");
  });

  it("explains the core service and a complete onboarding flow", () => {
    expect(MARKETING_FEATURES).toHaveLength(4);
    expect(MARKETING_FEATURES.map(({ description }) => description).join(" ")).toMatch(/공지/);
    expect(MARKETING_FEATURES.map(({ description }) => description).join(" ")).toMatch(/과제/);
    expect(MARKETING_FEATURES.map(({ description }) => description).join(" ")).toMatch(/제출/);
    expect(MARKETING_STEPS).toHaveLength(3);
  });
});
