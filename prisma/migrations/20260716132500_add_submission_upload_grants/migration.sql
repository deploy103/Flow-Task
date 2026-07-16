CREATE TYPE "SubmissionUploadStatus" AS ENUM ('PENDING', 'CONSUMED', 'FAILED');

CREATE TABLE "submission_uploads" (
  "id" UUID NOT NULL,
  "assignment_id" UUID NOT NULL,
  "field_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "storage_path" VARCHAR(500) NOT NULL,
  "original_filename" VARCHAR(255) NOT NULL,
  "mime_type" VARCHAR(100) NOT NULL,
  "size_bytes" BIGINT NOT NULL,
  "reserved_bytes" BIGINT NOT NULL,
  "status" "SubmissionUploadStatus" NOT NULL DEFAULT 'PENDING',
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  "consumed_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "submission_uploads_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "submission_uploads_size_positive" CHECK ("size_bytes" > 0),
  CONSTRAINT "submission_uploads_reservation_positive" CHECK ("reserved_bytes" > 0),
  CONSTRAINT "submission_uploads_consumed_state" CHECK (
    ("status" = 'CONSUMED' AND "consumed_at" IS NOT NULL) OR
    ("status" <> 'CONSUMED' AND "consumed_at" IS NULL)
  )
);

CREATE UNIQUE INDEX "submission_uploads_storage_path_key" ON "submission_uploads"("storage_path");
CREATE INDEX "submission_uploads_user_id_created_at_idx" ON "submission_uploads"("user_id", "created_at");
CREATE INDEX "submission_uploads_user_id_status_expires_at_idx" ON "submission_uploads"("user_id", "status", "expires_at");
CREATE INDEX "submission_uploads_assignment_id_field_id_user_id_idx" ON "submission_uploads"("assignment_id", "field_id", "user_id");

ALTER TABLE "submission_uploads" ADD CONSTRAINT "submission_uploads_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "assignments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "submission_uploads" ADD CONSTRAINT "submission_uploads_field_id_fkey" FOREIGN KEY ("field_id") REFERENCES "assignment_fields"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "submission_uploads" ADD CONSTRAINT "submission_uploads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "submission_uploads" ENABLE ROW LEVEL SECURITY;
