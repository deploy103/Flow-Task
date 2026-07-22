ALTER TABLE "users"
  ADD COLUMN "birth_date" DATE,
  ADD COLUMN "privacy_consent_at" TIMESTAMPTZ(6),
  ADD COLUMN "privacy_consent_version" VARCHAR(20),
  ADD CONSTRAINT "users_privacy_consent_complete_check"
    CHECK (("privacy_consent_at" IS NULL) = ("privacy_consent_version" IS NULL));
