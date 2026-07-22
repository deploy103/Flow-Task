export type QuizChoiceDraft = {
  content: string;
  isCorrect: boolean;
};

function encodeChoiceContent(content: string) {
  const normalized = content.trim();
  return normalized.startsWith("*") || normalized.startsWith("\\")
    ? `\\${normalized}`
    : normalized;
}

function decodeChoiceContent(content: string) {
  return content.startsWith("\\*") || content.startsWith("\\\\")
    ? content.slice(1)
    : content;
}

export function serializeQuizChoices(choices: QuizChoiceDraft[]) {
  return choices
    .map((choice) => `${choice.isCorrect ? "*" : ""}${encodeChoiceContent(choice.content)}`)
    .join("\n");
}

export function parseQuizChoices(value: string | undefined): QuizChoiceDraft[] {
  if (!value) return [];
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const isCorrect = line.startsWith("*");
      const markedContent = isCorrect ? line.slice(1).trim() : line;
      return { content: decodeChoiceContent(markedContent), isCorrect };
    });
}
