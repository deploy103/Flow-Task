ALTER TABLE "organizations"
  ADD COLUMN "logo_storage_path" VARCHAR(500),
  ADD COLUMN "logo_mime_type" VARCHAR(50),
  ADD COLUMN "logo_updated_at" TIMESTAMPTZ(6),
  ADD CONSTRAINT "organizations_logo_complete_check" CHECK (
    ("logo_storage_path" IS NULL AND "logo_mime_type" IS NULL AND "logo_updated_at" IS NULL)
    OR
    ("logo_storage_path" IS NOT NULL AND "logo_mime_type" IS NOT NULL AND "logo_updated_at" IS NOT NULL)
  );

CREATE UNIQUE INDEX "organizations_logo_storage_path_key" ON "organizations"("logo_storage_path");
