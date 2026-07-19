CREATE TYPE "SubmissionReviewDecision" AS ENUM ('REVIEWING', 'APPROVED', 'RESUBMIT_REQUIRED');

CREATE TABLE "submission_reviews" (
  "id" UUID NOT NULL,
  "submission_id" UUID NOT NULL,
  "version_id" UUID NOT NULL,
  "reviewer_id" UUID NOT NULL,
  "decision" "SubmissionReviewDecision" NOT NULL,
  "feedback" TEXT,
  "score" INTEGER,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "submission_reviews_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "submission_reviews_score_range" CHECK ("score" IS NULL OR ("score" >= 0 AND "score" <= 100)),
  CONSTRAINT "submission_reviews_resubmit_feedback" CHECK ("decision" <> 'RESUBMIT_REQUIRED' OR LENGTH(TRIM("feedback")) > 0)
);

CREATE INDEX "submission_reviews_submission_id_created_at_idx" ON "submission_reviews"("submission_id", "created_at");
CREATE INDEX "submission_reviews_version_id_created_at_idx" ON "submission_reviews"("version_id", "created_at");
CREATE INDEX "submission_reviews_reviewer_id_created_at_idx" ON "submission_reviews"("reviewer_id", "created_at");
CREATE UNIQUE INDEX "submission_versions_submission_id_id_key" ON "submission_versions"("submission_id", "id");

ALTER TABLE "submission_reviews" ADD CONSTRAINT "submission_reviews_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "submissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "submission_reviews" ADD CONSTRAINT "submission_reviews_submission_id_version_id_fkey" FOREIGN KEY ("submission_id", "version_id") REFERENCES "submission_versions"("submission_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "submission_reviews" ADD CONSTRAINT "submission_reviews_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "submission_reviews" ENABLE ROW LEVEL SECURITY;
