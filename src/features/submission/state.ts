import { SubmissionStatus } from "@prisma/client";

export type SubmissionIntent = "draft" | "submit";

export function resolveSubmissionStatus(
  intent: SubmissionIntent,
  assignment: { opensAt: Date; deadline: Date; allowLate: boolean },
  now = new Date(),
) {
  if (now < assignment.opensAt) return { allowed: false as const, reason: "not_open" as const };
  if (intent === "draft") {
    if (now > assignment.deadline && !assignment.allowLate) {
      return { allowed: false as const, reason: "closed" as const };
    }
    return { allowed: true as const, status: SubmissionStatus.DRAFT, submittedAt: null };
  }
  if (now > assignment.deadline && !assignment.allowLate) {
    return { allowed: false as const, reason: "closed" as const };
  }
  return {
    allowed: true as const,
    status: now > assignment.deadline ? SubmissionStatus.LATE : SubmissionStatus.SUBMITTED,
    submittedAt: now,
  };
}
