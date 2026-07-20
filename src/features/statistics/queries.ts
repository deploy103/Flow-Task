import { QuizAttemptStatus, QuizQuestionType, SubmissionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const AUTO_TYPES = [QuizQuestionType.SINGLE_CHOICE, QuizQuestionType.MULTIPLE_CHOICE, QuizQuestionType.SHORT_TEXT, QuizQuestionType.FLAG];

export async function getOrganizationStatistics(organizationId: string) {
  const [memberCount, assignments, announcements, quizAggregate, quizAnswers, questions] = await Promise.all([
    prisma.organizationMember.count({ where: { organizationId, status: "ACTIVE" } }),
    prisma.assignment.findMany({ where: { organizationId, archivedAt: null }, select: { id: true, title: true, audience: true, _count: { select: { targets: true, submissions: { where: { status: { not: SubmissionStatus.DRAFT } } } } } }, orderBy: { createdAt: "asc" } }),
    prisma.announcement.findMany({ where: { organizationId, archivedAt: null }, select: { id: true, title: true, audience: true, _count: { select: { targets: true, reads: true } } }, orderBy: { createdAt: "asc" } }),
    prisma.quizAttempt.aggregate({ where: { status: QuizAttemptStatus.GRADED, quiz: { assignmentItem: { assignment: { organizationId, archivedAt: null } } } }, _count: { id: true }, _avg: { score: true }, _min: { score: true }, _max: { score: true } }),
    prisma.quizAnswer.findMany({ where: { score: { not: null }, attempt: { status: { not: QuizAttemptStatus.IN_PROGRESS } }, question: { type: { in: AUTO_TYPES }, organizationId } }, select: { score: true, question: { select: { id: true, prompt: true, points: true } } } }),
    prisma.question.findMany({ where: { organizationId }, select: { createdAt: true, answers: { orderBy: { createdAt: "asc" }, take: 1, select: { createdAt: true } } } }),
  ]);
  const assignmentRows = assignments.map((item) => { const target = item.audience === "ALL_MEMBERS" ? memberCount : item._count.targets; const submitted = Math.min(item._count.submissions, target); return { title: item.title, submitted, target, rate: target ? submitted / target : 0 }; });
  const announcementRows = announcements.map((item) => { const target = item.audience === "ALL_MEMBERS" ? memberCount : item._count.targets; const read = Math.min(item._count.reads, target); return { title: item.title, read, target, rate: target ? read / target : 0 }; });
  const questionMap = new Map<string, { prompt: string; correct: number; total: number }>();
  for (const answer of quizAnswers) { const row = questionMap.get(answer.question.id) ?? { prompt: answer.question.prompt, correct: 0, total: 0 }; row.total += 1; if (answer.score === answer.question.points) row.correct += 1; questionMap.set(answer.question.id, row); }
  const responseTimes = questions.flatMap((question) => question.answers[0] ? [question.answers[0].createdAt.getTime() - question.createdAt.getTime()] : []);
  return {
    memberCount,
    assignmentRows,
    announcementRows,
    quiz: { attempts: quizAggregate._count.id, average: quizAggregate._avg.score, minimum: quizAggregate._min.score, maximum: quizAggregate._max.score, questions: [...questionMap.values()].map((row) => ({ ...row, rate: row.total ? row.correct / row.total : 0 })) },
    questions: { total: questions.length, unanswered: questions.filter((question) => !question.answers.length).length, averageFirstResponseMinutes: responseTimes.length ? responseTimes.reduce((sum, value) => sum + value, 0) / responseTimes.length / 60_000 : null },
  };
}

export type OrganizationStatistics = Awaited<ReturnType<typeof getOrganizationStatistics>>;
