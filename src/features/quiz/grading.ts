export function scoreChoiceAnswer(input: {
  type: "SINGLE_CHOICE" | "MULTIPLE_CHOICE";
  selectedChoiceIds: string[];
  choices: { id: string; isCorrect: boolean }[];
  points: number;
}) {
  const validIds = new Set(input.choices.map(({ id }) => id));
  if (new Set(input.selectedChoiceIds).size !== input.selectedChoiceIds.length || input.selectedChoiceIds.some((id) => !validIds.has(id))) return null;
  const correct = new Set(input.choices.filter(({ isCorrect }) => isCorrect).map(({ id }) => id));
  const selectedCorrect = input.selectedChoiceIds.filter((id) => correct.has(id)).length;
  const selectedWrong = input.selectedChoiceIds.length - selectedCorrect;
  if (input.type === "SINGLE_CHOICE") {
    if (input.selectedChoiceIds.length !== 1) return null;
    return selectedCorrect === 1 ? input.points : 0;
  }
  if (input.selectedChoiceIds.length === 0) return null;
  if (!correct.size) return 0;
  const fraction = Math.max(0, (selectedCorrect - selectedWrong) / correct.size);
  return Math.round(input.points * Math.min(1, fraction));
}

export function shouldReleaseQuizResult(input: {
  policy: "IMMEDIATE" | "AFTER_DEADLINE" | "AFTER_GRADING" | "HIDDEN";
  deadline: Date;
  status: "IN_PROGRESS" | "SUBMITTED" | "AUTO_SUBMITTED" | "GRADED";
  now?: Date;
}) {
  if (input.policy === "HIDDEN" || input.status !== "GRADED") return false;
  if (input.policy === "AFTER_DEADLINE") return (input.now ?? new Date()) > input.deadline;
  return true;
}
