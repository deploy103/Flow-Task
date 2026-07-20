import { describe, expect, it } from "vitest";
import {
  cleanupSubmissionUploadsBatch,
  type SubmissionCleanupDependencies,
} from "./cleanup";

describe("submission upload cleanup", () => {
  it("records a deletion failure and retries it successfully on the next run", async () => {
    let attempts = 0;
    let cleaned = false;
    const dependencies: SubmissionCleanupDependencies = {
      findCandidates: async () =>
        cleaned ? [] : [{ id: "upload-1", storagePath: "org/assignment/user/file.pdf" }],
      removeObject: async () => {
        attempts += 1;
        if (attempts === 1) throw new Error("temporary storage failure");
      },
      markCleaned: async () => {
        cleaned = true;
        return 1;
      },
      markFailed: async () => undefined,
    };
    const now = new Date("2026-07-16T02:10:00Z");
    await expect(cleanupSubmissionUploadsBatch(now, dependencies)).resolves.toEqual({
      scanned: 1,
      cleaned: 0,
      failed: 1,
    });
    await expect(
      cleanupSubmissionUploadsBatch(new Date("2026-07-16T02:25:00Z"), dependencies),
    ).resolves.toEqual({
      scanned: 1,
      cleaned: 1,
      failed: 0,
    });
    expect(attempts).toBe(2);
  });
});
