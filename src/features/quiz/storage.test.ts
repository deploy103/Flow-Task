import { describe, expect, it } from "vitest";
import { MAX_QUIZ_FILE_BYTES } from "@/constants/quiz";
import { quizFilePath, validateQuizFile } from "./storage";

describe("quiz answer storage", () => {
  it("uses random paths scoped to the organization and user", () => {
    const first = quizFilePath("org-id", "user-id", "pdf");
    const second = quizFilePath("org-id", "user-id", "pdf");
    expect(first).toMatch(/^org-id\/quiz-answers\/user-id\/[0-9a-f-]{36}\.pdf$/);
    expect(second).not.toBe(first);
  });

  it("rejects files over the 512KB quiz limit before upload", async () => {
    const oversized = new File([new Uint8Array(MAX_QUIZ_FILE_BYTES + 1)], "answer.pdf", { type: "application/pdf" });
    await expect(validateQuizFile(oversized)).rejects.toThrow("INVALID_QUIZ_FILE");
  });
});
