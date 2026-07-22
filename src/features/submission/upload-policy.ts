import {
  MAX_PENDING_SUBMISSION_UPLOAD_BYTES_PER_USER,
  MAX_PENDING_SUBMISSION_UPLOAD_BYTES_PER_ORGANIZATION,
  MAX_SUBMISSION_UPLOAD_REQUEST_BODY_BYTES,
  MAX_SUBMISSION_FILE_SIZE_BYTES,
  MAX_SUBMISSION_UPLOAD_BYTES_PER_WINDOW,
  MAX_SUBMISSION_UPLOAD_BYTES_PER_ORGANIZATION_WINDOW,
  MAX_SUBMISSION_UPLOAD_GRANTS_PER_WINDOW,
} from "@/constants/assignment";

function hasBoundedContentLength(contentLength: string | null, maximumBytes: number) {
  const parsedContentLength = Number(contentLength);
  return (
    Number.isInteger(parsedContentLength) &&
    parsedContentLength > 0 &&
    parsedContentLength <= maximumBytes
  );
}

export function hasBoundedSubmissionUploadRequestBody(input: {
  contentType: string | null;
  contentLength: string | null;
}) {
  return (
    input.contentType?.startsWith("multipart/form-data") === true &&
    hasBoundedContentLength(
      input.contentLength,
      MAX_SUBMISSION_FILE_SIZE_BYTES + MAX_SUBMISSION_UPLOAD_REQUEST_BODY_BYTES,
    )
  );
}

export function evaluateSubmissionUploadGrant(input: {
  recentGrantCount: number;
  recentBytes: bigint;
  activePendingBytes: bigint;
  organizationRecentBytes: bigint;
  organizationActivePendingBytes: bigint;
  reservationBytes: number;
}) {
  if (input.recentGrantCount >= MAX_SUBMISSION_UPLOAD_GRANTS_PER_WINDOW) {
    return { allowed: false as const, reason: "rate_limited" as const };
  }
  if (input.recentBytes + BigInt(input.reservationBytes) > BigInt(MAX_SUBMISSION_UPLOAD_BYTES_PER_WINDOW)) {
    return { allowed: false as const, reason: "window_quota" as const };
  }
  if (
    input.activePendingBytes + BigInt(input.reservationBytes) >
    BigInt(MAX_PENDING_SUBMISSION_UPLOAD_BYTES_PER_USER)
  ) {
    return { allowed: false as const, reason: "pending_quota" as const };
  }
  if (
    input.organizationRecentBytes + BigInt(input.reservationBytes) >
    BigInt(MAX_SUBMISSION_UPLOAD_BYTES_PER_ORGANIZATION_WINDOW)
  ) {
    return { allowed: false as const, reason: "organization_window_quota" as const };
  }
  if (
    input.organizationActivePendingBytes + BigInt(input.reservationBytes) >
    BigInt(MAX_PENDING_SUBMISSION_UPLOAD_BYTES_PER_ORGANIZATION)
  ) {
    return { allowed: false as const, reason: "organization_pending_quota" as const };
  }
  return { allowed: true as const };
}
