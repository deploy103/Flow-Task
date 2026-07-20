import { describe, expect, it } from "vitest";
import { canUsePushEndpoint, isAllowedPushEndpoint } from "./push-policy";

describe("web push endpoint policy", () => {
  it("allows known browser push services and rejects local or lookalike hosts", () => {
    expect(isAllowedPushEndpoint("https://fcm.googleapis.com/fcm/send/token")).toBe(true);
    expect(isAllowedPushEndpoint("https://updates.push.services.mozilla.com/wpush/v2/token")).toBe(true);
    expect(isAllowedPushEndpoint("https://fcm.googleapis.com.evil.example/send")).toBe(false);
    expect(isAllowedPushEndpoint("https://127.0.0.1/push")).toBe(false);
  });
  it("never transfers an existing subscription between users", () => {
    expect(canUsePushEndpoint(null, "current")).toBe(true);
    expect(canUsePushEndpoint("current", "current")).toBe(true);
    expect(canUsePushEndpoint("owner", "current")).toBe(false);
  });
});
