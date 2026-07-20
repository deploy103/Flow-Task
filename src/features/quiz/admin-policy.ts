import { MAX_QUIZ_TOTAL_POINTS } from "@/constants/quiz";

export function canAddQuizPoints(currentPoints: number, addedPoints: number) {
  return Number.isSafeInteger(currentPoints)
    && Number.isSafeInteger(addedPoints)
    && currentPoints >= 0
    && addedPoints >= 0
    && currentPoints + addedPoints <= MAX_QUIZ_TOTAL_POINTS;
}
