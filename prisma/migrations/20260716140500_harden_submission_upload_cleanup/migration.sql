ALTER TYPE "SubmissionUploadStatus" ADD VALUE 'CLEANED';

ALTER TABLE "submission_uploads"
  ADD COLUMN "signed_token_expires_at" TIMESTAMPTZ(6) NOT NULL DEFAULT (CURRENT_TIMESTAMP + INTERVAL '2 hours'),
  ADD COLUMN "cleanup_after" TIMESTAMPTZ(6) NOT NULL DEFAULT (CURRENT_TIMESTAMP + INTERVAL '2 hours 10 minutes'),
  ADD COLUMN "cleaned_at" TIMESTAMPTZ(6),
  ADD COLUMN "cleanup_attempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "last_cleanup_attempt_at" TIMESTAMPTZ(6),
  ADD COLUMN "cleanup_error" VARCHAR(80);

ALTER TABLE "submission_uploads" ADD CONSTRAINT "submission_uploads_cleanup_state" CHECK (
  ("status"::TEXT = 'CLEANED' AND "cleaned_at" IS NOT NULL AND "consumed_at" IS NULL) OR
  ("status"::TEXT <> 'CLEANED' AND "cleaned_at" IS NULL)
);

ALTER TABLE "submission_uploads" ADD CONSTRAINT "submission_uploads_cleanup_after_token" CHECK (
  "cleanup_after" >= "signed_token_expires_at"
);

CREATE INDEX "submission_uploads_status_cleanup_after_idx" ON "submission_uploads"("status", "cleanup_after");
