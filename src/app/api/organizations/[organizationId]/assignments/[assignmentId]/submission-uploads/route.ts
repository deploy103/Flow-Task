import { AssignmentFieldType, Prisma, SubmissionUploadStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  SUBMISSION_UPLOAD_RATE_WINDOW_MINUTES,
  SUBMISSION_UPLOAD_RESERVED_BYTES,
} from "@/constants/assignment";
import { getApiUser } from "@/features/auth/api";
import { canSubmitAssignment } from "@/features/submission/access";
import { hasValidSubmissionFileSignature, validateSubmissionFileMetadata } from "@/features/submission/policy";
import {
  cancelSubmissionUploadsSchema,
} from "@/features/submission/schemas";
import { resolveSubmissionStatus } from "@/features/submission/state";
import { createSubmissionStoragePath, removeSubmissionFile, uploadSubmissionFile } from "@/features/submission/storage";
import { getSubmissionUploadLifecycle } from "@/features/submission/upload-lifecycle";
import {
  evaluateSubmissionUploadGrant,
  hasBoundedSubmissionUploadRequestBody,
} from "@/features/submission/upload-policy";
import { prisma } from "@/lib/prisma";

const MILLISECONDS_PER_MINUTE = 60 * 1000;
const routeParamsSchema = z.object({ organizationId: z.uuid(), assignmentId: z.uuid() });

function jsonError(code: string, message: string, status: number) {
  return NextResponse.json({ success: false, error: { code, message } }, { status });
}

function hasBoundedJsonBody(request: Request) {
  return hasBoundedSubmissionUploadRequestBody({
    contentType: request.headers.get("content-type"),
    contentLength: request.headers.get("content-length"),
  });
}

async function getUploadContext(organizationId: string, assignmentId: string) {
  const user = await getApiUser();
  if (!user) return { error: jsonError("UNAUTHENTICATED", "로그인이 필요합니다.", 401) };
  const [membership, assignment] = await Promise.all([
    prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId, userId: user.id } },
    }),
    prisma.assignment.findFirst({
      where: { id: assignmentId, organizationId, archivedAt: null },
      include: { fields: true, targets: { select: { userId: true } } },
    }),
  ]);
  if (
    !assignment ||
    !canSubmitAssignment({
      audience: assignment.audience,
      targetUserIds: assignment.targets.map(({ userId }) => userId),
      userId: user.id,
      membershipStatus: membership?.status,
    })
  ) {
    return { error: jsonError("FORBIDDEN", "파일을 업로드할 수 없습니다.", 403) };
  }
  const timing = resolveSubmissionStatus("draft", assignment);
  if (!timing.allowed) {
    return { error: jsonError("SUBMISSION_CLOSED", "현재 제출할 수 없는 과제입니다.", 409) };
  }
  return { assignment, user };
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ organizationId: string; assignmentId: string }> },
) {
  if (!hasBoundedJsonBody(request)) return jsonError("INVALID_BODY", "요청 형식이 올바르지 않습니다.", 400);
  const parsedParams = routeParamsSchema.safeParse(await params);
  if (!parsedParams.success) return jsonError("INVALID_PATH", "요청 경로가 올바르지 않습니다.", 400);
  const { organizationId, assignmentId } = parsedParams.data;
  const context = await getUploadContext(organizationId, assignmentId);
  if ("error" in context) return context.error;

  let body: FormData;
  try {
    body = await request.formData();
  } catch {
    return jsonError("INVALID_BODY", "요청 형식이 올바르지 않습니다.", 400);
  }
  const fieldId = body.get("fieldId");
  const file = body.get("file");
  if (typeof fieldId !== "string" || !(file instanceof File)) {
    return jsonError("INVALID_FILE", "파일 정보가 올바르지 않습니다.", 400);
  }
  const field = context.assignment.fields.find(
    (candidate) => candidate.id === fieldId && candidate.type === AssignmentFieldType.FILE,
  );
  if (!field) return jsonError("INVALID_FIELD", "제출 파일 항목을 찾을 수 없습니다.", 400);
  const metadata = validateSubmissionFileMetadata({
    name: file.name,
    size: file.size,
    type: file.type,
  });
  if (!metadata || !(await hasValidSubmissionFileSignature(file, metadata.extension))) {
    return jsonError("INVALID_FILE", "허용되지 않는 파일입니다.", 400);
  }

  const now = new Date();
  const windowStartedAt = new Date(
    now.getTime() - SUBMISSION_UPLOAD_RATE_WINDOW_MINUTES * MILLISECONDS_PER_MINUTE,
  );
  const { cleanupAfter, expiresAt, uploadDeadline } = getSubmissionUploadLifecycle(now);
  const storagePath = createSubmissionStoragePath({
    organizationId,
    assignmentId,
    userId: context.user.id,
    extension: metadata.extension,
  });

  let grantResult:
    | { allowed: false; reason: string; expiredPaths: string[] }
    | { allowed: true; grantId: string; expiredPaths: string[] };
  try {
    grantResult = await prisma.$transaction(
      async (transaction) => {
        const expired = await transaction.submissionUpload.findMany({
          where: {
            userId: context.user.id,
            status: SubmissionUploadStatus.PENDING,
            expiresAt: { lte: now },
          },
          select: { id: true, storagePath: true },
        });
        if (expired.length) {
          await transaction.submissionUpload.updateMany({
            where: { id: { in: expired.map(({ id }) => id) } },
            data: { status: SubmissionUploadStatus.FAILED },
          });
        }
        const [
          recentGrantCount,
          recentBytes,
          activePendingBytes,
          organizationRecentBytes,
          organizationActivePendingBytes,
        ] = await Promise.all([
          transaction.submissionUpload.count({
            where: { userId: context.user.id, createdAt: { gte: windowStartedAt } },
          }),
          transaction.submissionUpload.aggregate({
            where: { userId: context.user.id, createdAt: { gte: windowStartedAt } },
            _sum: { reservedBytes: true },
          }),
          transaction.submissionUpload.aggregate({
            where: {
              userId: context.user.id,
              status: { in: [SubmissionUploadStatus.PENDING, SubmissionUploadStatus.FAILED] },
              cleanupAfter: { gt: now },
            },
            _sum: { reservedBytes: true },
          }),
          transaction.submissionUpload.aggregate({
            where: {
              assignment: { organizationId },
              createdAt: { gte: windowStartedAt },
            },
            _sum: { reservedBytes: true },
          }),
          transaction.submissionUpload.aggregate({
            where: {
              assignment: { organizationId },
              status: { in: [SubmissionUploadStatus.PENDING, SubmissionUploadStatus.FAILED] },
              cleanupAfter: { gt: now },
            },
            _sum: { reservedBytes: true },
          }),
        ]);
        const decision = evaluateSubmissionUploadGrant({
          recentGrantCount,
          recentBytes: recentBytes._sum.reservedBytes ?? BigInt(0),
          activePendingBytes: activePendingBytes._sum.reservedBytes ?? BigInt(0),
          organizationRecentBytes: organizationRecentBytes._sum.reservedBytes ?? BigInt(0),
          organizationActivePendingBytes:
            organizationActivePendingBytes._sum.reservedBytes ?? BigInt(0),
          reservationBytes: SUBMISSION_UPLOAD_RESERVED_BYTES,
        });
        if (!decision.allowed) {
          return {
            allowed: false as const,
            reason: decision.reason,
            expiredPaths: expired.map(({ storagePath }) => storagePath),
          };
        }
        const grant = await transaction.submissionUpload.create({
          data: {
            assignmentId,
            fieldId: field.id,
            userId: context.user.id,
            storagePath,
            originalFilename: metadata.originalFilename,
            mimeType: metadata.mimeType,
            sizeBytes: BigInt(metadata.sizeBytes),
            reservedBytes: BigInt(SUBMISSION_UPLOAD_RESERVED_BYTES),
            expiresAt,
            uploadDeadline,
            cleanupAfter,
          },
        });
        return {
          allowed: true as const,
          grantId: grant.id,
          expiredPaths: expired.map(({ storagePath }) => storagePath),
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch {
    return jsonError("UPLOAD_GRANT_FAILED", "업로드를 준비하지 못했습니다.", 503);
  }
  await Promise.allSettled(grantResult.expiredPaths.map((path) => removeSubmissionFile(path)));
  if (!grantResult.allowed) {
    return jsonError("UPLOAD_LIMIT_EXCEEDED", "업로드 요청 한도 또는 용량을 초과했습니다.", 429);
  }

  try {
    await uploadSubmissionFile(storagePath, file);
    return NextResponse.json({
      success: true,
      data: { uploadId: grantResult.grantId },
    });
  } catch {
    await Promise.allSettled([
      removeSubmissionFile(storagePath),
      prisma.submissionUpload.updateMany({
        where: { id: grantResult.grantId, status: SubmissionUploadStatus.PENDING },
        data: {
          status: SubmissionUploadStatus.FAILED,
          uploadDeadline: now,
          cleanupAfter: now,
        },
      }),
    ]);
    return jsonError("STORAGE_POLICY_INVALID", "파일 저장소를 사용할 수 없습니다.", 503);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ organizationId: string; assignmentId: string }> },
) {
  if (!hasBoundedJsonBody(request)) return jsonError("INVALID_BODY", "요청 형식이 올바르지 않습니다.", 400);
  const parsedParams = routeParamsSchema.safeParse(await params);
  if (!parsedParams.success) return jsonError("INVALID_PATH", "요청 경로가 올바르지 않습니다.", 400);
  const { organizationId, assignmentId } = parsedParams.data;
  const context = await getUploadContext(organizationId, assignmentId);
  if ("error" in context) return context.error;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("INVALID_BODY", "요청 형식이 올바르지 않습니다.", 400);
  }
  const parsed = cancelSubmissionUploadsSchema.safeParse(body);
  if (!parsed.success) return jsonError("INVALID_UPLOADS", "업로드 정보가 올바르지 않습니다.", 400);
  const uploads = await prisma.submissionUpload.findMany({
    where: {
      id: { in: parsed.data.uploadIds },
      assignmentId,
      userId: context.user.id,
      status: SubmissionUploadStatus.PENDING,
    },
    select: { id: true, storagePath: true },
  });
  await prisma.submissionUpload.updateMany({
    where: { id: { in: uploads.map(({ id }) => id) } },
    data: { status: SubmissionUploadStatus.FAILED },
  });
  await Promise.allSettled(uploads.map(({ storagePath }) => removeSubmissionFile(storagePath)));
  return NextResponse.json({ success: true, data: { cancelled: uploads.length } });
}
