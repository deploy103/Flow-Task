import { AssignmentAudience, SubmissionStatus } from "@prisma/client";

export const DEADLINE_NOTICE_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

export function shouldNotifyAssignmentTarget(input: {
  audience: AssignmentAudience;
  targetUserIds: string[];
  userId: string;
}) {
  return (
    input.audience === AssignmentAudience.ALL_MEMBERS ||
    input.targetUserIds.includes(input.userId)
  );
}

export function hasFinalSubmission(status?: SubmissionStatus | null) {
  return Boolean(status && status !== SubmissionStatus.DRAFT);
}

export function isAssignmentNotificationPublished(opensAt: Date, now = new Date()) {
  return opensAt <= now;
}

export function getDeadlineNotificationKind(input: {
  now: Date;
  opensAt: Date;
  deadline: Date;
  submissionStatus?: SubmissionStatus | null;
}) {
  if (input.opensAt > input.now || hasFinalSubmission(input.submissionStatus)) return null;
  if (input.deadline <= input.now) return "MISSING_SUBMISSION" as const;
  if (input.deadline.getTime() - input.now.getTime() <= DEADLINE_NOTICE_WINDOW_MS) {
    return "DEADLINE_APPROACHING" as const;
  }
  return null;
}
