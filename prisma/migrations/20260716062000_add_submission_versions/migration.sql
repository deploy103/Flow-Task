CREATE TYPE "SubmissionStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'LATE', 'REVIEWING', 'APPROVED', 'RESUBMIT_REQUIRED');

CREATE TABLE "submissions" (
  "id" UUID NOT NULL,
  "assignment_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "status" "SubmissionStatus" NOT NULL DEFAULT 'DRAFT',
  "latest_version" INTEGER NOT NULL DEFAULT 0,
  "submitted_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "submissions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "submissions_latest_version_nonnegative" CHECK ("latest_version" >= 0)
);

CREATE TABLE "submission_versions" (
  "id" UUID NOT NULL,
  "submission_id" UUID NOT NULL,
  "version" INTEGER NOT NULL,
  "status" "SubmissionStatus" NOT NULL,
  "saved_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "submitted_at" TIMESTAMPTZ(6),
  CONSTRAINT "submission_versions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "submission_versions_version_positive" CHECK ("version" > 0)
);

CREATE TABLE "submission_answers" (
  "id" UUID NOT NULL,
  "version_id" UUID NOT NULL,
  "field_id" UUID NOT NULL,
  "value" TEXT NOT NULL,
  CONSTRAINT "submission_answers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "submission_files" (
  "id" UUID NOT NULL,
  "version_id" UUID NOT NULL,
  "field_id" UUID NOT NULL,
  "storage_path" VARCHAR(500) NOT NULL,
  "original_filename" VARCHAR(255) NOT NULL,
  "mime_type" VARCHAR(100) NOT NULL,
  "size_bytes" BIGINT NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "submission_files_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "submission_files_size_positive" CHECK ("size_bytes" > 0)
);

CREATE UNIQUE INDEX "submissions_assignment_id_user_id_key" ON "submissions"("assignment_id", "user_id");
CREATE INDEX "submissions_assignment_id_status_idx" ON "submissions"("assignment_id", "status");
CREATE INDEX "submissions_user_id_updated_at_idx" ON "submissions"("user_id", "updated_at");
CREATE UNIQUE INDEX "submission_versions_submission_id_version_key" ON "submission_versions"("submission_id", "version");
CREATE INDEX "submission_versions_submission_id_saved_at_idx" ON "submission_versions"("submission_id", "saved_at");
CREATE UNIQUE INDEX "submission_answers_version_id_field_id_key" ON "submission_answers"("version_id", "field_id");
CREATE INDEX "submission_answers_field_id_idx" ON "submission_answers"("field_id");
CREATE INDEX "submission_files_version_id_field_id_idx" ON "submission_files"("version_id", "field_id");
CREATE INDEX "submission_files_field_id_idx" ON "submission_files"("field_id");
CREATE INDEX "submission_files_storage_path_idx" ON "submission_files"("storage_path");

ALTER TABLE "submissions" ADD CONSTRAINT "submissions_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "assignments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "submission_versions" ADD CONSTRAINT "submission_versions_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "submissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "submission_answers" ADD CONSTRAINT "submission_answers_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "submission_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "submission_answers" ADD CONSTRAINT "submission_answers_field_id_fkey" FOREIGN KEY ("field_id") REFERENCES "assignment_fields"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "submission_files" ADD CONSTRAINT "submission_files_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "submission_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "submission_files" ADD CONSTRAINT "submission_files_field_id_fkey" FOREIGN KEY ("field_id") REFERENCES "assignment_fields"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "submissions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "submission_versions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "submission_answers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "submission_files" ENABLE ROW LEVEL SECURITY;
