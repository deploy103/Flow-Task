import { notFound } from "next/navigation";
import { z } from "zod";
import { requireAuthenticatedUser } from "@/features/auth/guards";
import { canDownloadSubmissionFile } from "@/features/submission/access";
import { downloadSubmissionFile } from "@/features/submission/storage";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ fileId: string }> },
) {
  const parsedFileId = z.uuid().safeParse((await params).fileId);
  if (!parsedFileId.success) notFound();
  const fileId = parsedFileId.data;
  const user = await requireAuthenticatedUser();
  const file = await prisma.submissionFile.findUnique({
    where: { id: fileId },
    include: {
      version: {
        include: {
          submission: { include: { assignment: { select: { organizationId: true } } } },
        },
      },
    },
  });
  if (!file) notFound();

  const organizationId = file.version.submission.assignment.organizationId;
  const membership = await prisma.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId, userId: user.id } },
  });
  const canDownload = canDownloadSubmissionFile({
    isOwner: file.version.submission.userId === user.id,
    systemRole: user.systemRole,
    membership,
  });
  if (!canDownload) notFound();

  try {
    const blob = await downloadSubmissionFile(file.storagePath);
    return new Response(blob, {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": `attachment; filename="submission-file"; filename*=UTF-8''${encodeURIComponent(file.originalFilename)}`,
        "Content-Length": file.sizeBytes.toString(),
        "Content-Type": file.mimeType,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("파일을 불러올 수 없습니다.", { status: 502 });
  }
}
