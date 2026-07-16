import {
  KOREAN_TIME_OFFSET_MILLISECONDS,
  MILLISECONDS_PER_DAY,
} from "@/constants/assignment";

export type AssignmentTimingStatus = "UPCOMING" | "OPEN" | "CLOSED" | "LATE_OPEN";

export function getAssignmentTimingStatus(
  assignment: { opensAt: Date; deadline: Date; allowLate: boolean },
  now = new Date(),
): AssignmentTimingStatus {
  if (now < assignment.opensAt) return "UPCOMING";
  if (now <= assignment.deadline) return "OPEN";
  return assignment.allowLate ? "LATE_OPEN" : "CLOSED";
}

export function getDeadlineLabel(deadline: Date, now = new Date()) {
  const remainingMilliseconds = deadline.getTime() - now.getTime();
  if (remainingMilliseconds < 0) return "마감 종료";
  const deadlineDay = Math.floor(
    (deadline.getTime() + KOREAN_TIME_OFFSET_MILLISECONDS) / MILLISECONDS_PER_DAY,
  );
  const currentDay = Math.floor(
    (now.getTime() + KOREAN_TIME_OFFSET_MILLISECONDS) / MILLISECONDS_PER_DAY,
  );
  const remainingDays = deadlineDay - currentDay;
  if (remainingDays === 0) return "오늘 마감";
  return `D-${remainingDays}`;
}
