import { SubmissionUploadStatus } from "@prisma/client";
import {
  SUBMISSION_UPLOAD_CLEANUP_BATCH_SIZE,
  SUBMISSION_UPLOAD_CLEANUP_MAX_BATCHES,
  SUBMISSION_UPLOAD_CLEANUP_RETRY_MINUTES,
} from "@/constants/assignment";
import { prisma } from "@/lib/prisma";
import { removeSubmissionFile } from "./storage";

type CleanupCandidate = { id: string; storagePath: string };

export type SubmissionCleanupDependencies = {
  findCandidates: (now: Date, limit: number) => Promise<CleanupCandidate[]>;
  removeObject: (storagePath: string) => Promise<void>;
  markCleaned: (id: string, now: Date) => Promise<number>;
  markFailed: (id: string, now: Date) => Promise<void>;
};

const cleanupDependencies: SubmissionCleanupDependencies = {
  findCandidates: (now, limit) => {
    const retryBefore = new Date(
      now.getTime() - SUBMISSION_UPLOAD_CLEANUP_RETRY_MINUTES * 60 * 1000,
    );
    return prisma.submissionUpload.findMany({
      where: {
        status: { in: [SubmissionUploadStatus.PENDING, SubmissionUploadStatus.FAILED] },
        cleanupAfter: { lte: now },
        consumedAt: null,
        OR: [
          { lastCleanupAttemptAt: null },
          { lastCleanupAttemptAt: { lte: retryBefore } },
        ],
      },
      orderBy: { cleanupAfter: "asc" },
      take: limit,
      select: { id: true, storagePath: true },
    });
  },
  removeObject: removeSubmissionFile,
  markCleaned: async (id, now) => {
    const result = await prisma.submissionUpload.updateMany({
      where: {
        id,
        status: { in: [SubmissionUploadStatus.PENDING, SubmissionUploadStatus.FAILED] },
        consumedAt: null,
      },
      data: {
        status: SubmissionUploadStatus.CLEANED,
        cleanedAt: now,
        cleanupAttempts: { increment: 1 },
        lastCleanupAttemptAt: now,
        cleanupError: null,
      },
    });
    return result.count;
  },
  markFailed: async (id, now) => {
    await prisma.submissionUpload.updateMany({
      where: {
        id,
        status: { in: [SubmissionUploadStatus.PENDING, SubmissionUploadStatus.FAILED] },
        consumedAt: null,
      },
      data: {
        status: SubmissionUploadStatus.FAILED,
        cleanupAttempts: { increment: 1 },
        lastCleanupAttemptAt: now,
        cleanupError: "STORAGE_REMOVE_FAILED",
      },
    });
  },
};

export async function cleanupSubmissionUploadsBatch(
  now = new Date(),
  dependencies: SubmissionCleanupDependencies = cleanupDependencies,
) {
  const candidates = await dependencies.findCandidates(now, SUBMISSION_UPLOAD_CLEANUP_BATCH_SIZE);
  let cleaned = 0;
  let failed = 0;
  await Promise.all(
    candidates.map(async (candidate) => {
      try {
        await dependencies.removeObject(candidate.storagePath);
        cleaned += await dependencies.markCleaned(candidate.id, now);
      } catch {
        failed += 1;
        await Promise.allSettled([dependencies.markFailed(candidate.id, now)]);
      }
    }),
  );
  return { scanned: candidates.length, cleaned, failed };
}

export async function runSubmissionUploadJanitor(now = new Date()) {
  const total = { scanned: 0, cleaned: 0, failed: 0, batches: 0 };
  for (let batch = 0; batch < SUBMISSION_UPLOAD_CLEANUP_MAX_BATCHES; batch += 1) {
    const result = await cleanupSubmissionUploadsBatch(now);
    total.scanned += result.scanned;
    total.cleaned += result.cleaned;
    total.failed += result.failed;
    total.batches += 1;
    if (result.scanned < SUBMISSION_UPLOAD_CLEANUP_BATCH_SIZE) break;
  }
  return total;
}
