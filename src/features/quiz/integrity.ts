import { createHmac } from "node:crypto";
import { QuizIntegrityEventType } from "@prisma/client";
import { MIN_CHALLENGE_FLAG_PEPPER_LENGTH } from "@/constants/challenge";

export function integrityDedupeKey(type: QuizIntegrityEventType, occurredAt: Date) {
  return `${type}:${Math.floor(occurredAt.getTime() / 60_000)}`;
}

export function isPlausibleIntegrityTime(occurredAt: Date, now = new Date()) {
  return Math.abs(now.getTime() - occurredAt.getTime()) <= 5 * 60_000;
}

export function digestQuizClientIp(ip: string, explicitPepper?: string) {
  const pepper = explicitPepper ?? process.env.CHALLENGE_FLAG_PEPPER;
  if (!pepper || pepper.length < MIN_CHALLENGE_FLAG_PEPPER_LENGTH) throw new Error("QUIZ_INTEGRITY_PEPPER_REQUIRED");
  return createHmac("sha256", pepper).update("flow-task/quiz-client-ip/v1\0").update(ip).digest("hex");
}
