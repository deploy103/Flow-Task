ALTER TYPE "AssignmentItemType" ADD VALUE 'QUIZ';
CREATE TYPE "QuizQuestionType" AS ENUM ('SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'SHORT_TEXT', 'LONG_TEXT', 'FLAG', 'FILE');
CREATE TYPE "QuizAttemptStatus" AS ENUM ('IN_PROGRESS', 'SUBMITTED', 'AUTO_SUBMITTED', 'GRADED');
CREATE TYPE "QuizResultRelease" AS ENUM ('IMMEDIATE', 'AFTER_DEADLINE', 'AFTER_GRADING', 'HIDDEN');

CREATE TABLE "quizzes" (
  "assignment_item_id" UUID NOT NULL,
  "title" VARCHAR(160) NOT NULL,
  "description" TEXT NOT NULL,
  "time_limit_minutes" INTEGER,
  "attempt_limit" INTEGER NOT NULL DEFAULT 1,
  "passing_score" INTEGER,
  "shuffle_questions" BOOLEAN NOT NULL DEFAULT false,
  "shuffle_choices" BOOLEAN NOT NULL DEFAULT false,
  "result_release" "QuizResultRelease" NOT NULL DEFAULT 'AFTER_GRADING',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "quizzes_pkey" PRIMARY KEY ("assignment_item_id"),
  CONSTRAINT "quizzes_title_check" CHECK (length(btrim("title")) > 0),
  CONSTRAINT "quizzes_description_check" CHECK (length(btrim("description")) > 0 AND length("description") <= 20000),
  CONSTRAINT "quizzes_time_limit_check" CHECK ("time_limit_minutes" IS NULL OR "time_limit_minutes" BETWEEN 1 AND 1440),
  CONSTRAINT "quizzes_attempt_limit_check" CHECK ("attempt_limit" BETWEEN 1 AND 100),
  CONSTRAINT "quizzes_passing_score_check" CHECK ("passing_score" IS NULL OR "passing_score" BETWEEN 0 AND 100000)
);

CREATE TABLE "quiz_questions" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "created_by_id" UUID NOT NULL,
  "type" "QuizQuestionType" NOT NULL,
  "prompt" TEXT NOT NULL,
  "description" TEXT,
  "points" INTEGER NOT NULL,
  "required" BOOLEAN NOT NULL DEFAULT true,
  "difficulty" VARCHAR(40) NOT NULL,
  "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "explanation" TEXT,
  "case_sensitive" BOOLEAN NOT NULL DEFAULT false,
  "trim_whitespace" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "quiz_questions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "quiz_questions_prompt_check" CHECK (length(btrim("prompt")) > 0 AND length("prompt") <= 20000),
  CONSTRAINT "quiz_questions_description_check" CHECK ("description" IS NULL OR length("description") <= 20000),
  CONSTRAINT "quiz_questions_points_check" CHECK ("points" BETWEEN 0 AND 100000),
  CONSTRAINT "quiz_questions_difficulty_check" CHECK (length(btrim("difficulty")) > 0),
  CONSTRAINT "quiz_questions_explanation_check" CHECK ("explanation" IS NULL OR length("explanation") <= 20000)
);

CREATE TABLE "quiz_choices" (
  "id" UUID NOT NULL,
  "question_id" UUID NOT NULL,
  "content" VARCHAR(1000) NOT NULL,
  "is_correct" BOOLEAN NOT NULL,
  "position" INTEGER NOT NULL,
  CONSTRAINT "quiz_choices_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "quiz_choices_content_check" CHECK (length(btrim("content")) > 0),
  CONSTRAINT "quiz_choices_position_check" CHECK ("position" >= 0)
);

CREATE TABLE "quiz_accepted_answers" (
  "id" UUID NOT NULL,
  "question_id" UUID NOT NULL,
  "digest" CHAR(64) NOT NULL,
  CONSTRAINT "quiz_accepted_answers_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "quiz_accepted_answers_digest_check" CHECK ("digest" ~ '^[0-9a-f]{64}$')
);

CREATE TABLE "quiz_question_placements" (
  "quiz_id" UUID NOT NULL,
  "question_id" UUID NOT NULL,
  "position" INTEGER NOT NULL,
  CONSTRAINT "quiz_question_placements_pkey" PRIMARY KEY ("quiz_id", "question_id"),
  CONSTRAINT "quiz_question_placements_position_check" CHECK ("position" >= 0)
);

CREATE TABLE "quiz_attempts" (
  "id" UUID NOT NULL,
  "quiz_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "attempt_number" INTEGER NOT NULL,
  "status" "QuizAttemptStatus" NOT NULL DEFAULT 'IN_PROGRESS',
  "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMPTZ(6),
  "submitted_at" TIMESTAMPTZ(6),
  "auto_submitted" BOOLEAN NOT NULL DEFAULT false,
  "score" INTEGER,
  "max_score" INTEGER NOT NULL,
  "passed" BOOLEAN,
  "question_order" JSONB NOT NULL,
  "choice_order" JSONB NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "quiz_attempts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "quiz_attempts_number_check" CHECK ("attempt_number" > 0),
  CONSTRAINT "quiz_attempts_time_check" CHECK ("expires_at" IS NULL OR "expires_at" > "started_at"),
  CONSTRAINT "quiz_attempts_submission_check" CHECK (("status" = 'IN_PROGRESS' AND "submitted_at" IS NULL) OR ("status" <> 'IN_PROGRESS' AND "submitted_at" IS NOT NULL)),
  CONSTRAINT "quiz_attempts_auto_submission_check" CHECK (NOT "auto_submitted" OR "status" <> 'IN_PROGRESS'),
  CONSTRAINT "quiz_attempts_question_order_check" CHECK (jsonb_typeof("question_order") = 'array'),
  CONSTRAINT "quiz_attempts_choice_order_check" CHECK (jsonb_typeof("choice_order") = 'object'),
  CONSTRAINT "quiz_attempts_score_check" CHECK ("score" IS NULL OR ("score" >= 0 AND "score" <= "max_score")),
  CONSTRAINT "quiz_attempts_max_score_check" CHECK ("max_score" BETWEEN 0 AND 1000000)
);

CREATE TABLE "quiz_answers" (
  "id" UUID NOT NULL,
  "attempt_id" UUID NOT NULL,
  "question_id" UUID NOT NULL,
  "response" JSONB NOT NULL,
  "score" INTEGER,
  "feedback" TEXT,
  "graded_by_id" UUID,
  "graded_at" TIMESTAMPTZ(6),
  "saved_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "quiz_answers_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "quiz_answers_response_check" CHECK (jsonb_typeof("response") = 'object'),
  CONSTRAINT "quiz_answers_score_check" CHECK ("score" IS NULL OR "score" >= 0),
  CONSTRAINT "quiz_answers_grade_check" CHECK (("graded_by_id" IS NULL AND "graded_at" IS NULL) OR ("graded_by_id" IS NOT NULL AND "graded_at" IS NOT NULL))
);

CREATE TABLE "quiz_answer_files" (
  "answer_id" UUID NOT NULL,
  "storage_path" VARCHAR(500) NOT NULL,
  "original_filename" VARCHAR(255) NOT NULL,
  "mime_type" VARCHAR(150) NOT NULL,
  "size_bytes" BIGINT NOT NULL,
  CONSTRAINT "quiz_answer_files_pkey" PRIMARY KEY ("answer_id"),
  CONSTRAINT "quiz_answer_files_size_check" CHECK ("size_bytes" > 0 AND "size_bytes" <= 524288),
  CONSTRAINT "quiz_answer_files_filename_check" CHECK (length(btrim("original_filename")) > 0)
);

CREATE INDEX "quiz_questions_organization_id_type_created_at_idx" ON "quiz_questions"("organization_id", "type", "created_at");
CREATE INDEX "quiz_questions_tags_idx" ON "quiz_questions" USING GIN ("tags");
CREATE UNIQUE INDEX "quiz_choices_question_id_position_key" ON "quiz_choices"("question_id", "position");
CREATE UNIQUE INDEX "quiz_accepted_answers_question_id_digest_key" ON "quiz_accepted_answers"("question_id", "digest");
CREATE UNIQUE INDEX "quiz_question_placements_quiz_id_position_key" ON "quiz_question_placements"("quiz_id", "position");
CREATE UNIQUE INDEX "quiz_attempts_quiz_id_user_id_attempt_number_key" ON "quiz_attempts"("quiz_id", "user_id", "attempt_number");
CREATE INDEX "quiz_attempts_quiz_id_status_submitted_at_idx" ON "quiz_attempts"("quiz_id", "status", "submitted_at");
CREATE INDEX "quiz_attempts_user_id_updated_at_idx" ON "quiz_attempts"("user_id", "updated_at");
CREATE UNIQUE INDEX "quiz_answers_attempt_id_question_id_key" ON "quiz_answers"("attempt_id", "question_id");
CREATE INDEX "quiz_answers_question_id_graded_at_idx" ON "quiz_answers"("question_id", "graded_at");
CREATE UNIQUE INDEX "quiz_answer_files_storage_path_key" ON "quiz_answer_files"("storage_path");

ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_assignment_item_id_fkey" FOREIGN KEY ("assignment_item_id") REFERENCES "assignment_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "quiz_questions" ADD CONSTRAINT "quiz_questions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "quiz_questions" ADD CONSTRAINT "quiz_questions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "quiz_choices" ADD CONSTRAINT "quiz_choices_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "quiz_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "quiz_accepted_answers" ADD CONSTRAINT "quiz_accepted_answers_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "quiz_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "quiz_question_placements" ADD CONSTRAINT "quiz_question_placements_quiz_id_fkey" FOREIGN KEY ("quiz_id") REFERENCES "quizzes"("assignment_item_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "quiz_question_placements" ADD CONSTRAINT "quiz_question_placements_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "quiz_questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_quiz_id_fkey" FOREIGN KEY ("quiz_id") REFERENCES "quizzes"("assignment_item_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "quiz_answers" ADD CONSTRAINT "quiz_answers_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "quiz_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "quiz_answers" ADD CONSTRAINT "quiz_answers_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "quiz_questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "quiz_answers" ADD CONSTRAINT "quiz_answers_graded_by_id_fkey" FOREIGN KEY ("graded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "quiz_answer_files" ADD CONSTRAINT "quiz_answer_files_answer_id_fkey" FOREIGN KEY ("answer_id") REFERENCES "quiz_answers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "quizzes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "quiz_questions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "quiz_choices" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "quiz_accepted_answers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "quiz_question_placements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "quiz_attempts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "quiz_answers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "quiz_answer_files" ENABLE ROW LEVEL SECURITY;
