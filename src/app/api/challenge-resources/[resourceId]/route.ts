import { notFound } from "next/navigation";
import { z } from "zod";
import { requireAuthenticatedUser } from "@/features/auth/guards";
import { canDownloadChallengeResource } from "@/features/challenge/resource-access";
import { downloadChallengeResource } from "@/features/challenge/resource-storage";
import { canManageOrganization, canReviewSubmissions } from "@/features/organization/permissions";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ resourceId: string }> },
) {
  const id = z.uuid().safeParse((await params).resourceId);
  if (!id.success) notFound();
  const user = await requireAuthenticatedUser();
  const resource = await prisma.challengeResource.findUnique({
    where: { id: id.data },
    select: {
      storagePath: true,
      originalFilename: true,
      mimeType: true,
      sizeBytes: true,
      internalChallenge: {
        select: {
          assignmentItem: {
            select: {
              assignment: {
                select: {
                  archivedAt: true,
                  audience: true,
                  opensAt: true,
                  organizationId: true,
                  targets: { select: { userId: true } },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!resource) notFound();
  const assignment = resource.internalChallenge.assignmentItem.assignment;
  if (assignment.archivedAt) notFound();
  const membership = await prisma.organizationMember.findUnique({
    where: {
      organizationId_userId: { organizationId: assignment.organizationId, userId: user.id },
    },
  });
  const canManage = canManageOrganization({ systemRole: user.systemRole, membership });
  const canReview = canReviewSubmissions({ systemRole: user.systemRole, membership });
  const allowed = canDownloadChallengeResource({
    archivedAt: assignment.archivedAt,
    audience: assignment.audience,
    opensAt: assignment.opensAt,
    targetUserIds: assignment.targets.map(({ userId }) => userId),
    userId: user.id,
    systemRole: user.systemRole,
    membershipStatus: membership?.status,
    canManage,
    canReview,
  });
  if (!allowed) notFound();

  try {
    const blob = await downloadChallengeResource(resource.storagePath);
    return new Response(blob, {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": `attachment; filename="challenge-resource"; filename*=UTF-8''${encodeURIComponent(resource.originalFilename)}`,
        "Content-Length": String(resource.sizeBytes),
        "Content-Type": resource.mimeType,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("파일을 불러올 수 없습니다.", { status: 502 });
  }
}
