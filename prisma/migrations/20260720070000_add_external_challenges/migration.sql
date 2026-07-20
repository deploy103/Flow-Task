CREATE TYPE "AssignmentItemType" AS ENUM ('EXTERNAL_CHALLENGE');
CREATE TYPE "ExternalChallengeSource" AS ENUM ('DREAMHACK', 'OTHER');
CREATE TYPE "ChallengeCategory" AS ENUM (
  'WEB',
  'SYSTEM',
  'REVERSING',
  'FORENSICS',
  'CRYPTOGRAPHY',
  'NETWORK',
  'PROGRAMMING',
  'OTHER'
);

CREATE TABLE "assignment_items" (
  "id" UUID NOT NULL,
  "assignment_id" UUID NOT NULL,
  "type" "AssignmentItemType" NOT NULL,
  "position" INTEGER NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "assignment_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "assignment_items_position_check" CHECK ("position" >= 0)
);

CREATE TABLE "external_challenges" (
  "assignment_item_id" UUID NOT NULL,
  "source" "ExternalChallengeSource" NOT NULL,
  "platform" VARCHAR(80) NOT NULL,
  "title" VARCHAR(160) NOT NULL,
  "description" TEXT NOT NULL,
  "problem_url" VARCHAR(2048) NOT NULL,
  "category" "ChallengeCategory" NOT NULL,
  "difficulty" VARCHAR(40) NOT NULL,
  "points" INTEGER NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "external_challenges_pkey" PRIMARY KEY ("assignment_item_id"),
  CONSTRAINT "external_challenges_platform_check" CHECK (length(btrim("platform")) > 0),
  CONSTRAINT "external_challenges_title_check" CHECK (length(btrim("title")) > 0),
  CONSTRAINT "external_challenges_description_check" CHECK (
    length(btrim("description")) > 0 AND length("description") <= 20000
  ),
  CONSTRAINT "external_challenges_problem_url_check" CHECK (
    "problem_url" ~ '^https://[^[:space:]]+$'
  ),
  CONSTRAINT "external_challenges_difficulty_check" CHECK (length(btrim("difficulty")) > 0),
  CONSTRAINT "external_challenges_points_check" CHECK ("points" >= 0 AND "points" <= 100000)
);

CREATE TABLE "challenge_grading" (
  "assignment_item_id" UUID NOT NULL,
  "flag_digest" CHAR(64),
  "flag_format" VARCHAR(160),
  "case_sensitive" BOOLEAN NOT NULL DEFAULT true,
  "trim_whitespace" BOOLEAN NOT NULL DEFAULT true,
  "max_attempts" INTEGER,
  "penalty_per_wrong_attempt" INTEGER NOT NULL DEFAULT 0,
  "require_writeup" BOOLEAN NOT NULL DEFAULT false,
  "require_writeup_url" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "challenge_grading_pkey" PRIMARY KEY ("assignment_item_id"),
  CONSTRAINT "challenge_grading_flag_digest_check" CHECK (
    "flag_digest" IS NULL OR "flag_digest" ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT "challenge_grading_flag_format_check" CHECK (
    "flag_format" IS NULL OR length(btrim("flag_format")) > 0
  ),
  CONSTRAINT "challenge_grading_max_attempts_check" CHECK (
    "max_attempts" IS NULL OR ("max_attempts" >= 1 AND "max_attempts" <= 10000)
  ),
  CONSTRAINT "challenge_grading_penalty_check" CHECK (
    "penalty_per_wrong_attempt" >= 0 AND "penalty_per_wrong_attempt" <= 100000
  ),
  CONSTRAINT "challenge_grading_submission_method_check" CHECK (
    "flag_digest" IS NOT NULL OR "require_writeup" OR "require_writeup_url"
  )
);

CREATE TABLE "challenge_submissions" (
  "id" UUID NOT NULL,
  "assignment_item_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "attempts_count" INTEGER NOT NULL DEFAULT 0,
  "completed_at" TIMESTAMPTZ(6),
  "score" INTEGER NOT NULL DEFAULT 0,
  "writeup" TEXT,
  "writeup_url" VARCHAR(2048),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "challenge_submissions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "challenge_submissions_attempts_count_check" CHECK ("attempts_count" >= 0),
  CONSTRAINT "challenge_submissions_score_check" CHECK ("score" >= 0 AND "score" <= 100000),
  CONSTRAINT "challenge_submissions_writeup_check" CHECK (
    "writeup" IS NULL OR (length(btrim("writeup")) > 0 AND length("writeup") <= 50000)
  ),
  CONSTRAINT "challenge_submissions_writeup_url_check" CHECK (
    "writeup_url" IS NULL OR "writeup_url" ~ '^https://[^[:space:]]+$'
  )
);

CREATE TABLE "challenge_attempts" (
  "id" UUID NOT NULL,
  "assignment_item_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "attempt_number" INTEGER NOT NULL,
  "is_correct" BOOLEAN NOT NULL,
  "score_after_attempt" INTEGER NOT NULL,
  "submitted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "challenge_attempts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "challenge_attempts_attempt_number_check" CHECK ("attempt_number" > 0),
  CONSTRAINT "challenge_attempts_score_check" CHECK (
    "score_after_attempt" >= 0 AND "score_after_attempt" <= 100000
  )
);

CREATE UNIQUE INDEX "assignment_items_assignment_id_position_key"
ON "assignment_items"("assignment_id", "position");
CREATE INDEX "assignment_items_assignment_id_type_idx"
ON "assignment_items"("assignment_id", "type");
CREATE INDEX "external_challenges_source_category_idx"
ON "external_challenges"("source", "category");
CREATE UNIQUE INDEX "challenge_submissions_assignment_item_id_user_id_key"
ON "challenge_submissions"("assignment_item_id", "user_id");
CREATE INDEX "challenge_submissions_assignment_item_id_completed_at_idx"
ON "challenge_submissions"("assignment_item_id", "completed_at");
CREATE INDEX "challenge_submissions_user_id_updated_at_idx"
ON "challenge_submissions"("user_id", "updated_at");
CREATE UNIQUE INDEX "challenge_attempts_assignment_item_id_user_id_attempt_number_key"
ON "challenge_attempts"("assignment_item_id", "user_id", "attempt_number");
CREATE INDEX "challenge_attempts_assignment_item_id_submitted_at_idx"
ON "challenge_attempts"("assignment_item_id", "submitted_at");
CREATE INDEX "challenge_attempts_user_id_submitted_at_idx"
ON "challenge_attempts"("user_id", "submitted_at");

ALTER TABLE "assignment_items"
ADD CONSTRAINT "assignment_items_assignment_id_fkey"
FOREIGN KEY ("assignment_id") REFERENCES "assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "external_challenges"
ADD CONSTRAINT "external_challenges_assignment_item_id_fkey"
FOREIGN KEY ("assignment_item_id") REFERENCES "assignment_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "challenge_grading"
ADD CONSTRAINT "challenge_grading_assignment_item_id_fkey"
FOREIGN KEY ("assignment_item_id") REFERENCES "assignment_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "challenge_submissions"
ADD CONSTRAINT "challenge_submissions_assignment_item_id_fkey"
FOREIGN KEY ("assignment_item_id") REFERENCES "assignment_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "challenge_submissions"
ADD CONSTRAINT "challenge_submissions_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "challenge_attempts"
ADD CONSTRAINT "challenge_attempts_submission_fkey"
FOREIGN KEY ("assignment_item_id", "user_id")
REFERENCES "challenge_submissions"("assignment_item_id", "user_id")
ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE FUNCTION "prevent_challenge_attempt_mutation"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'challenge attempts are append-only' USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER "challenge_attempts_append_only"
BEFORE UPDATE OR DELETE ON "challenge_attempts"
FOR EACH ROW EXECUTE FUNCTION "prevent_challenge_attempt_mutation"();

ALTER TABLE "assignment_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "external_challenges" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "challenge_grading" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "challenge_submissions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "challenge_attempts" ENABLE ROW LEVEL SECURITY;
