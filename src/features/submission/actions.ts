"use server";

import { AssignmentFieldType, Prisma, SubmissionUploadStatus } from "@prisma/client";
import { redirect } from "next/navigation";
import {
  MAX_SUBMISSION_FILE_COUNT,
  MAX_SUBMISSION_TOTAL_FILE_SIZE_BYTES,
} from "@/constants/assignment";
import { requireOrganizationAccess } from "@/features/organization/guards";
import { prisma } from "@/lib/prisma";
import { canSubmitAssignment } from "./access";
import { validateSubmissionFileMetadata } from "./policy";
import {
  submissionContextSchema,
  submissionLinkSchema,
  submissionTextSchema,
  submissionUploadIdsSchema,
} from "./schemas";
import { resolveSubmissionStatus } from "./state";
import { removeSubmissionFile, verifyStoredSubmissionUpload } from "./storage";
import { getNextSubmissionVersion, hasSubmissionVersionConflict } from "./versioning";

type StoredFile = {
  fieldId: string;
  storagePath: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: bigint;
};

function submissionRedirect(organizationId: string, assignmentId: string, query: string): never {
  redirect(`/organizations/${organizationId}/assignments/${assignmentId}?${query}`);
}

export async function saveSubmission(formData: FormData) {
  const parsedContext = submissionContextSchema.safeParse({
    organizationId: formData.get("organizationId"),
    assignmentId: formData.get("assignmentId"),
    intent: formData.get("intent"),
  });
  if (!parsedContext.success) redirect("/dashboard?error=invalid_submission");
  const { organizationId, assignmentId, intent } = parsedContext.data;
  const { user, membership } = await requireOrganizationAccess(organizationId);

  const assignment = await prisma.assignment.findFirst({
    where: { id: assignmentId, organizationId, archivedAt: null },
    include: {
      fields: { orderBy: { position: "asc" } },
      targets: { select: { userId: true } },
      submissions: {
        where: { userId: user.id },
        include: {
          versions: {
            orderBy: { version: "desc" },
            take: 1,
            include: { answers: true, files: true },
          },
        },
      },
    },
  });
  if (!assignment) submissionRedirect(organizationId, assignmentId, "error=assignment_not_found");
  if (
    !canSubmitAssignment({
      audience: assignment.audience,
      targetUserIds: assignment.targets.map(({ userId }) => userId),
      userId: user.id,
      membershipStatus: membership?.status,
    })
  ) {
    submissionRedirect(organizationId, assignmentId, "error=not_target");
  }

  const resolvedState = resolveSubmissionStatus(intent, assignment);
  if (!resolvedState.allowed) {
    submissionRedirect(organizationId, assignmentId, `error=${resolvedState.reason}`);
  }

  const currentSubmission = assignment.submissions[0];
  const currentVersion = currentSubmission?.versions[0];
  const answers: { fieldId: string; value: string }[] = [];
  const files: StoredFile[] = [];
  const selectedUploadIds: string[] = [];

  for (const field of assignment.fields) {
    if (field.type === AssignmentFieldType.TEXT || field.type === AssignmentFieldType.LINK) {
      const rawValue = formData.get(`field-${field.id}`);
      if (typeof rawValue !== "string") {
        submissionRedirect(organizationId, assignmentId, "error=invalid_input");
      }
      const parsedValue =
        field.type === AssignmentFieldType.TEXT
          ? submissionTextSchema.safeParse(rawValue)
          : submissionLinkSchema.safeParse(rawValue);
      if (!parsedValue.success || (intent === "submit" && field.required && !parsedValue.data.trim())) {
        submissionRedirect(organizationId, assignmentId, "error=invalid_input");
      }
      if (parsedValue.data) answers.push({ fieldId: field.id, value: parsedValue.data });
      continue;
    }

    const rawUploadIds = formData.getAll(`upload-${field.id}`);
    if (!rawUploadIds.every((value): value is string => typeof value === "string")) {
      submissionRedirect(organizationId, assignmentId, "error=invalid_file_count");
    }
    const parsedUploadIds = submissionUploadIdsSchema.safeParse(rawUploadIds);
    if (!parsedUploadIds.success) {
      submissionRedirect(organizationId, assignmentId, "error=invalid_file_count");
    }
    if (parsedUploadIds.data.length) {
      const uploads = await prisma.submissionUpload.findMany({
        where: {
          id: { in: parsedUploadIds.data },
          assignmentId,
          fieldId: field.id,
          userId: user.id,
          status: SubmissionUploadStatus.PENDING,
          expiresAt: { gt: new Date() },
        },
      });
      if (uploads.length !== parsedUploadIds.data.length) {
        submissionRedirect(organizationId, assignmentId, "error=invalid_file");
      }
      if (
        uploads.length > MAX_SUBMISSION_FILE_COUNT ||
        uploads.reduce((total, upload) => total + upload.sizeBytes, BigInt(0)) >
          BigInt(MAX_SUBMISSION_TOTAL_FILE_SIZE_BYTES)
      ) {
        submissionRedirect(organizationId, assignmentId, "error=invalid_file_count");
      }
      for (const upload of uploads) {
        const metadata = validateSubmissionFileMetadata({
          name: upload.originalFilename,
          size: Number(upload.sizeBytes),
          type: upload.mimeType,
        });
        let verified = false;
        if (metadata) {
          try {
            verified = await verifyStoredSubmissionUpload({
              storagePath: upload.storagePath,
              sizeBytes: metadata.sizeBytes,
              mimeType: metadata.mimeType,
              extension: metadata.extension,
            });
          } catch {
            verified = false;
          }
        }
        if (!metadata || !verified) {
          await prisma.submissionUpload.update({
            where: { id: upload.id },
            data: { status: SubmissionUploadStatus.FAILED },
          });
          await Promise.allSettled([removeSubmissionFile(upload.storagePath)]);
          submissionRedirect(organizationId, assignmentId, "error=invalid_file");
        }
        selectedUploadIds.push(upload.id);
        files.push({
          fieldId: field.id,
          storagePath: upload.storagePath,
          originalFilename: metadata.originalFilename,
          mimeType: metadata.mimeType,
          sizeBytes: upload.sizeBytes,
        });
      }
    } else {
      files.push(
        ...(currentVersion?.files
          .filter((file) => file.fieldId === field.id)
          .map((file) => ({
            fieldId: file.fieldId,
            storagePath: file.storagePath,
            originalFilename: file.originalFilename,
            mimeType: file.mimeType,
            sizeBytes: file.sizeBytes,
          })) ?? []),
      );
    }
    if (
      intent === "submit" &&
      field.required &&
      !files.some((file) => file.fieldId === field.id) &&
      !selectedUploadIds.length
    ) {
      submissionRedirect(organizationId, assignmentId, "error=file_required");
    }
  }

  try {
    await prisma.$transaction(
      async (transaction) => {
        const existing = await transaction.submission.findUnique({
          where: { assignmentId_userId: { assignmentId, userId: user.id } },
        });
        if (
          existing &&
          hasSubmissionVersionConflict(existing.latestVersion, currentSubmission?.latestVersion ?? 0)
        ) {
          throw new Error("SUBMISSION_VERSION_CONFLICT");
        }
        if (selectedUploadIds.length) {
          const availableUploads = await transaction.submissionUpload.count({
            where: {
              id: { in: selectedUploadIds },
              assignmentId,
              userId: user.id,
              status: SubmissionUploadStatus.PENDING,
              expiresAt: { gt: new Date() },
            },
          });
          if (availableUploads !== selectedUploadIds.length) {
            throw new Error("SUBMISSION_UPLOAD_CONFLICT");
          }
        }
        const submission =
          existing ??
          (await transaction.submission.create({
            data: { assignmentId, userId: user.id },
          }));
        const nextVersion = getNextSubmissionVersion(submission.latestVersion);
        await transaction.submissionVersion.create({
          data: {
            submissionId: submission.id,
            version: nextVersion,
            status: resolvedState.status,
            submittedAt: resolvedState.submittedAt,
            answers: { createMany: { data: answers } },
            files: { createMany: { data: files } },
          },
        });
        await transaction.submission.update({
          where: { id: submission.id },
          data: {
            latestVersion: nextVersion,
            status: resolvedState.status,
            submittedAt: resolvedState.submittedAt,
          },
        });
        if (selectedUploadIds.length) {
          const consumed = await transaction.submissionUpload.updateMany({
            where: {
              id: { in: selectedUploadIds },
              status: SubmissionUploadStatus.PENDING,
            },
            data: { status: SubmissionUploadStatus.CONSUMED, consumedAt: new Date() },
          });
          if (consumed.count !== selectedUploadIds.length) {
            throw new Error("SUBMISSION_UPLOAD_CONFLICT");
          }
        }
        await transaction.auditLog.create({
          data: {
            actorId: user.id,
            organizationId,
            action: intent === "submit" ? "SUBMISSION_SUBMITTED" : "SUBMISSION_DRAFT_SAVED",
            targetType: "SUBMISSION",
            targetId: submission.id,
            metadata: { assignmentId, version: nextVersion, status: resolvedState.status },
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch {
    submissionRedirect(organizationId, assignmentId, "error=save_failed");
  }

  submissionRedirect(
    organizationId,
    assignmentId,
    intent === "submit" ? "success=submitted" : "success=draft_saved",
  );
}
