CREATE TABLE "user_credentials" (
  "user_id" UUID NOT NULL,
  "password_hash" VARCHAR(255) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "user_credentials_pkey" PRIMARY KEY ("user_id")
);

CREATE TABLE "auth_sessions" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "token_hash" CHAR(64) NOT NULL,
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_seen_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revoked_at" TIMESTAMPTZ(6),
  CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "auth_rate_limits" (
  "key_hash" CHAR(64) NOT NULL,
  "action" VARCHAR(20) NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "window_started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "auth_rate_limits_pkey" PRIMARY KEY ("key_hash", "action")
);

CREATE UNIQUE INDEX "auth_sessions_token_hash_key" ON "auth_sessions"("token_hash");
CREATE INDEX "auth_sessions_user_id_expires_at_idx" ON "auth_sessions"("user_id", "expires_at");
CREATE INDEX "auth_sessions_expires_at_revoked_at_idx" ON "auth_sessions"("expires_at", "revoked_at");
CREATE INDEX "auth_rate_limits_updated_at_idx" ON "auth_rate_limits"("updated_at");

ALTER TABLE "user_credentials" ADD CONSTRAINT "user_credentials_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_credentials" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "auth_sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "auth_rate_limits" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "submission_uploads" RENAME COLUMN "signed_token_expires_at" TO "upload_deadline";
