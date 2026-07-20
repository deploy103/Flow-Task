import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("manual quiz grading concurrency", () => {
  it("locks the attempt before reading or updating answers and uses serializable isolation", () => {
    const source = readFileSync(new URL("./attempt-actions.ts", import.meta.url), "utf8");
    const action = source.slice(source.indexOf("export async function gradeQuizAnswer"));
    const lock = action.indexOf('SELECT "id" FROM "quiz_attempts"');
    const answerRead = action.indexOf("transaction.quizAnswer.findFirst");

    expect(lock).toBeGreaterThan(-1);
    expect(answerRead).toBeGreaterThan(lock);
    expect(action).toContain("Prisma.TransactionIsolationLevel.Serializable");
  });
});
