import { SubmissionUploadStatus, type SubmissionUploadStatus as UploadStatus } from "@prisma/client";
import {
  SUBMISSION_UPLOAD_CLEANUP_GRACE_MINUTES,
  SUBMISSION_UPLOAD_GRANT_TTL_MINUTES,
} from "@/constants/assignment";

const MILLISECONDS_PER_MINUTE = 60 * 1000;

export function getSubmissionUploadLifecycle(now = new Date()) {
  const expiresAt = new Date(
    now.getTime() + SUBMISSION_UPLOAD_GRANT_TTL_MINUTES * MILLISECONDS_PER_MINUTE,
  );
  const uploadDeadline = expiresAt;
  const cleanupAfter = new Date(
    uploadDeadline.getTime() + SUBMISSION_UPLOAD_CLEANUP_GRACE_MINUTES * MILLISECONDS_PER_MINUTE,
  );
  return { cleanupAfter, expiresAt, uploadDeadline };
}

export function isSubmissionUploadCleanupEligible(
  upload: {
    status: UploadStatus;
    cleanupAfter: Date;
    consumedAt: Date | null;
  },
  now = new Date(),
) {
  return (
    (upload.status === SubmissionUploadStatus.PENDING ||
      upload.status === SubmissionUploadStatus.FAILED) &&
    upload.consumedAt === null &&
    upload.cleanupAfter <= now
  );
}
