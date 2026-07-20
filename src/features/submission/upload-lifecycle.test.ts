import { SubmissionUploadStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  getSubmissionUploadLifecycle,
  isSubmissionUploadCleanupEligible,
} from "./upload-lifecycle";

const createdAt = new Date("2026-07-16T00:00:00Z");

describe("submission upload lifecycle", () => {
  it("keeps cleanup after both the app grant and signed token expiration", () => {
    const lifecycle = getSubmissionUploadLifecycle(createdAt);
    expect(lifecycle.expiresAt).toEqual(new Date("2026-07-16T00:15:00Z"));
    expect(lifecycle.signedTokenExpiresAt).toEqual(new Date("2026-07-16T02:00:00Z"));
    expect(lifecycle.cleanupAfter).toEqual(new Date("2026-07-16T02:10:00Z"));
  });

  it("does not clean a page-abandoned upload while its signed token may still be valid", () => {
    const lifecycle = getSubmissionUploadLifecycle(createdAt);
    expect(
      isSubmissionUploadCleanupEligible(
        {
          status: SubmissionUploadStatus.PENDING,
          cleanupAfter: lifecycle.cleanupAfter,
          consumedAt: null,
        },
        new Date("2026-07-16T00:16:00Z"),
      ),
    ).toBe(false);
  });

  it("cleans expired pending uploads independently of assignment or membership state", () => {
    expect(
      isSubmissionUploadCleanupEligible(
        {
          status: SubmissionUploadStatus.PENDING,
          cleanupAfter: new Date("2026-07-16T02:10:00Z"),
          consumedAt: null,
        },
        new Date("2026-07-16T02:10:00Z"),
      ),
    ).toBe(true);
  });

  it("retries failed deletion candidates but never removes consumed or cleaned uploads", () => {
    const cleanupAfter = new Date("2026-07-16T02:10:00Z");
    const now = new Date("2026-07-16T02:11:00Z");
    expect(
      isSubmissionUploadCleanupEligible({ status: SubmissionUploadStatus.FAILED, cleanupAfter, consumedAt: null }, now),
    ).toBe(true);
    expect(
      isSubmissionUploadCleanupEligible({ status: SubmissionUploadStatus.CONSUMED, cleanupAfter, consumedAt: now }, now),
    ).toBe(false);
    expect(
      isSubmissionUploadCleanupEligible({ status: SubmissionUploadStatus.CLEANED, cleanupAfter, consumedAt: null }, now),
    ).toBe(false);
  });
});
