import { describe, expect, it } from "vitest";
import { MAX_CHALLENGE_RESOURCE_BYTES } from "@/constants/challenge";
import { challengeResourcePath, validateChallengeResource } from "./resource-storage";

describe("challenge resource storage policy", () => {
  it("uses organization and actor scoped random storage paths", () => {
    const first = challengeResourcePath("organization", "actor", "zip");
    const second = challengeResourcePath("organization", "actor", "zip");
    expect(first).toMatch(/^organization\/challenges\/actor\/[0-9a-f-]+\.zip$/);
    expect(second).not.toBe(first);
  });

  it("rejects a resource above the small server-action limit", async () => {
    const file = new File([new Uint8Array(MAX_CHALLENGE_RESOURCE_BYTES + 1)], "challenge.zip", {
      type: "application/zip",
    });
    await expect(validateChallengeResource(file)).rejects.toThrow("INVALID_CHALLENGE_RESOURCE");
  });
});
