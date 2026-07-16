import { AssignmentAudience, MembershipStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function getAssignmentSubmissionRoster(organizationId: string, assignmentId: string) {
  const assignment = await prisma.assignment.findFirst({
    where: { id: assignmentId, organizationId, archivedAt: null },
    select: {
      id: true,
      title: true,
      audience: true,
      deadline: true,
      targets: { select: { userId: true } },
    },
  });
  if (!assignment) return null;
  const members = await prisma.organizationMember.findMany({
    where: {
      organizationId,
      status: MembershipStatus.ACTIVE,
      ...(assignment.audience === AssignmentAudience.SELECTED_MEMBERS
        ? { userId: { in: assignment.targets.map(({ userId }) => userId) } }
        : {}),
    },
    include: { user: { select: { id: true, name: true, email: true, studentNumber: true } } },
    orderBy: [{ user: { name: "asc" } }, { userId: "asc" }],
  });
  const submissions = await prisma.submission.findMany({
    where: { assignmentId, userId: { in: members.map(({ userId }) => userId) } },
    include: {
      reviews: {
        orderBy: { createdAt: "desc" },
        select: { score: true, createdAt: true, version: { select: { version: true } } },
      },
    },
  });
  const submissionByUserId = new Map(
    submissions.map((submission) => [
      submission.userId,
      {
        ...submission,
        reviews: submission.reviews
          .filter((review) => review.version.version === submission.latestVersion)
          .slice(0, 1),
      },
    ]),
  );
  return {
    assignment,
    rows: members.map((member) => ({ member, submission: submissionByUserId.get(member.userId) ?? null })),
  };
}
