import { describe, expect, it } from "vitest";
import {
  MAX_PENDING_SUBMISSION_UPLOAD_BYTES_PER_USER,
  MAX_PENDING_SUBMISSION_UPLOAD_BYTES_PER_ORGANIZATION,
  MAX_SUBMISSION_UPLOAD_BYTES_PER_WINDOW,
  MAX_SUBMISSION_UPLOAD_BYTES_PER_ORGANIZATION_WINDOW,
  MAX_SUBMISSION_UPLOAD_GRANTS_PER_WINDOW,
} from "@/constants/assignment";
import {
  evaluateSubmissionUploadGrant,
  hasBoundedSubmissionUploadRequestBody,
} from "./upload-policy";

describe("submission upload request body", () => {
  it("requires bounded multipart file uploads with a declared length", () => {
    expect(
      hasBoundedSubmissionUploadRequestBody({
        contentType: "multipart/form-data; boundary=test",
        contentLength: "512",
      }),
    ).toBe(true);
    expect(
      hasBoundedSubmissionUploadRequestBody({ contentType: "multipart/form-data", contentLength: null }),
    ).toBe(false);
    expect(
      hasBoundedSubmissionUploadRequestBody({
        contentType: "application/json",
        contentLength: "512",
      }),
    ).toBe(false);
  });
});

describe("submission upload grants", () => {
  it("allows requests inside rate and byte quotas", () => {
    expect(
      evaluateSubmissionUploadGrant({
        recentGrantCount: 0,
        recentBytes: BigInt(0),
        activePendingBytes: BigInt(0),
        organizationRecentBytes: BigInt(0),
        organizationActivePendingBytes: BigInt(0),
        reservationBytes: 1,
      }),
    ).toEqual({ allowed: true });
  });

  it("blocks the grant count boundary", () => {
    expect(
      evaluateSubmissionUploadGrant({
        recentGrantCount: MAX_SUBMISSION_UPLOAD_GRANTS_PER_WINDOW,
        recentBytes: BigInt(0),
        activePendingBytes: BigInt(0),
        organizationRecentBytes: BigInt(0),
        organizationActivePendingBytes: BigInt(0),
        reservationBytes: 1,
      }),
    ).toEqual({ allowed: false, reason: "rate_limited" });
  });

  it("blocks rolling-window and active-pending byte quota overflow", () => {
    expect(
      evaluateSubmissionUploadGrant({
        recentGrantCount: 0,
        recentBytes: BigInt(MAX_SUBMISSION_UPLOAD_BYTES_PER_WINDOW),
        activePendingBytes: BigInt(0),
        organizationRecentBytes: BigInt(0),
        organizationActivePendingBytes: BigInt(0),
        reservationBytes: 1,
      }),
    ).toEqual({ allowed: false, reason: "window_quota" });
    expect(
      evaluateSubmissionUploadGrant({
        recentGrantCount: 0,
        recentBytes: BigInt(0),
        activePendingBytes: BigInt(MAX_PENDING_SUBMISSION_UPLOAD_BYTES_PER_USER),
        organizationRecentBytes: BigInt(0),
        organizationActivePendingBytes: BigInt(0),
        reservationBytes: 1,
      }),
    ).toEqual({ allowed: false, reason: "pending_quota" });
  });

  it("blocks organization rolling and pending quotas", () => {
    const base = {
      recentGrantCount: 0,
      recentBytes: BigInt(0),
      activePendingBytes: BigInt(0),
      reservationBytes: 1,
    };
    expect(
      evaluateSubmissionUploadGrant({
        ...base,
        organizationRecentBytes: BigInt(MAX_SUBMISSION_UPLOAD_BYTES_PER_ORGANIZATION_WINDOW),
        organizationActivePendingBytes: BigInt(0),
      }),
    ).toEqual({ allowed: false, reason: "organization_window_quota" });
    expect(
      evaluateSubmissionUploadGrant({
        ...base,
        organizationRecentBytes: BigInt(0),
        organizationActivePendingBytes: BigInt(
          MAX_PENDING_SUBMISSION_UPLOAD_BYTES_PER_ORGANIZATION,
        ),
      }),
    ).toEqual({ allowed: false, reason: "organization_pending_quota" });
  });
});
