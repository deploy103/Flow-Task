import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("online quiz migration", () => {
  const migration = readFileSync(
    new URL("../../../prisma/migrations/20260720075000_add_online_quizzes/migration.sql", import.meta.url),
    "utf8",
  );

  it("enables RLS on every quiz table", () => {
    for (const table of ["quizzes", "quiz_questions", "quiz_choices", "quiz_accepted_answers", "quiz_question_placements", "quiz_attempts", "quiz_answers", "quiz_answer_files"]) {
      expect(migration).toContain(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`);
    }
  });

  it("constrains digests, snapshots, file sizes, and relational ownership", () => {
    expect(migration).toContain(`CHECK ("digest" ~ '^[0-9a-f]{64}$')`);
    expect(migration).toContain('"question_order" JSONB NOT NULL');
    expect(migration).toContain('"choice_order" JSONB NOT NULL');
    expect(migration).toContain('jsonb_typeof("question_order") = \'array\'');
    expect(migration).toContain('jsonb_typeof("choice_order") = \'object\'');
    expect(migration).toContain('NOT "auto_submitted" OR "status" <> \'IN_PROGRESS\'');
    expect(migration).toContain('jsonb_typeof("response") = \'object\'');
    expect(migration).toContain('"size_bytes" > 0 AND "size_bytes" <= 524288');
    expect(migration).toContain('FOREIGN KEY ("quiz_id") REFERENCES "quizzes"("assignment_item_id")');
    expect(migration).toContain('FOREIGN KEY ("answer_id") REFERENCES "quiz_answers"("id")');
    expect(migration).toContain('"status" = \'IN_PROGRESS\' AND "submitted_at" IS NULL');
  });
});
