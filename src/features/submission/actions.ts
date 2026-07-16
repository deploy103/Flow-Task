"use server";

import { AssignmentFieldType, Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import { requireOrganizationAccess } from "@/features/organization/guards";
import { prisma } from "@/lib/prisma";
import { canSubmitAssignment } from "./access";
import { hasValidSubmissionFileSignature, validateSubmissionFile } from "./policy";
import { submissionContextSchema, submissionLinkSchema, submissionTextSchema } from "./schemas";
import { resolveSubmissionStatus } from "./state";
import { removeSubmissionFile, uploadSubmissionFile } from "./storage";
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
  const pendingFiles: {
    fieldId: string;
    file: File;
    metadata: NonNullable<ReturnType<typeof validateSubmissionFile>>;
  }[] = [];
  const uploadedStoragePaths: string[] = [];

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

    const uploadedValue = formData.get(`field-${field.id}`);
    const uploadedFile = uploadedValue instanceof File && uploadedValue.size > 0 ? uploadedValue : null;
    if (uploadedFile) {
      const metadata = validateSubmissionFile(uploadedFile);
      if (!metadata) submissionRedirect(organizationId, assignmentId, "error=invalid_file");
      if (!(await hasValidSubmissionFileSignature(uploadedFile, metadata.extension))) {
        submissionRedirect(organizationId, assignmentId, "error=invalid_file");
      }
      pendingFiles.push({ fieldId: field.id, file: uploadedFile, metadata });
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
      !pendingFiles.some((file) => file.fieldId === field.id)
    ) {
      submissionRedirect(organizationId, assignmentId, "error=file_required");
    }
  }

  try {
    for (const pendingFile of pendingFiles) {
      const storagePath = await uploadSubmissionFile(pendingFile.file, pendingFile.metadata, {
        organizationId,
        assignmentId,
        userId: user.id,
      });
      uploadedStoragePaths.push(storagePath);
      files.push({
        fieldId: pendingFile.fieldId,
        storagePath,
        originalFilename: pendingFile.metadata.originalFilename,
        mimeType: pendingFile.metadata.mimeType,
        sizeBytes: BigInt(pendingFile.metadata.sizeBytes),
      });
    }
  } catch {
    await Promise.allSettled(uploadedStoragePaths.map((path) => removeSubmissionFile(path)));
    submissionRedirect(organizationId, assignmentId, "error=upload_failed");
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
    await Promise.allSettled(uploadedStoragePaths.map((path) => removeSubmissionFile(path)));
    submissionRedirect(organizationId, assignmentId, "error=save_failed");
  }

  submissionRedirect(
    organizationId,
    assignmentId,
    intent === "submit" ? "success=submitted" : "success=draft_saved",
  );
}
