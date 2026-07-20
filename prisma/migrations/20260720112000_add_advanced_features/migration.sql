ALTER TYPE "InternalChallengeMode" ADD VALUE 'PERSONAL_INSTANCE';
CREATE TYPE "ChallengeInstanceStatus" AS ENUM ('STARTING', 'RUNNING', 'STOPPED', 'EXPIRED', 'FAILED');
CREATE TYPE "OrganizationIntegrationKind" AS ENUM ('DISCORD_WEBHOOK', 'GENERIC_WEBHOOK', 'EMAIL_RELAY');
CREATE TYPE "NotificationChannel" AS ENUM ('EMAIL', 'WEB_PUSH', 'DISCORD');
CREATE TYPE "NotificationDeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');
CREATE TYPE "QuizIntegrityEventType" AS ENUM ('TAB_HIDDEN', 'WINDOW_BLUR', 'COPY', 'PASTE', 'IP_CHANGED');

ALTER TABLE "internal_challenges"
  ADD COLUMN "instance_template_ref" VARCHAR(160),
  ADD COLUMN "instance_cpu_milli" INTEGER,
  ADD COLUMN "instance_memory_mb" INTEGER,
  ADD COLUMN "instance_lifetime_minutes" INTEGER,
  ADD CONSTRAINT "internal_challenges_instance_check" CHECK (
    ("mode" = 'PERSONAL_INSTANCE' AND "instance_template_ref" IS NOT NULL AND "instance_cpu_milli" BETWEEN 100 AND 2000 AND "instance_memory_mb" BETWEEN 64 AND 2048 AND "instance_lifetime_minutes" BETWEEN 5 AND 120 AND "protocol" IS NULL AND "host" IS NULL AND "port" IS NULL)
    OR
    ("mode" <> 'PERSONAL_INSTANCE' AND "instance_template_ref" IS NULL AND "instance_cpu_milli" IS NULL AND "instance_memory_mb" IS NULL AND "instance_lifetime_minutes" IS NULL)
  );

CREATE TABLE "notification_preferences" (
  "user_id" UUID NOT NULL,
  "email_enabled" BOOLEAN NOT NULL DEFAULT false,
  "web_push_enabled" BOOLEAN NOT NULL DEFAULT false,
  "discord_enabled" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("user_id")
);

CREATE TABLE "web_push_subscriptions" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "endpoint" VARCHAR(2048) NOT NULL,
  "endpoint_hash" CHAR(64) NOT NULL,
  "p256dh" VARCHAR(180) NOT NULL,
  "auth" VARCHAR(80) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_used_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "web_push_subscriptions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "web_push_subscriptions_endpoint_check" CHECK ("endpoint" ~ '^https://'),
  CONSTRAINT "web_push_subscriptions_hash_check" CHECK ("endpoint_hash" ~ '^[0-9a-f]{64}$')
);

CREATE TABLE "notification_deliveries" (
  "id" UUID NOT NULL,
  "notification_id" UUID NOT NULL,
  "channel" "NotificationChannel" NOT NULL,
  "status" "NotificationDeliveryStatus" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "next_attempt_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "delivered_at" TIMESTAMPTZ(6),
  "last_error" VARCHAR(80),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "notification_deliveries_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "notification_deliveries_attempts_check" CHECK ("attempts" BETWEEN 0 AND 5),
  CONSTRAINT "notification_deliveries_status_check" CHECK (("status" = 'SENT' AND "delivered_at" IS NOT NULL) OR ("status" <> 'SENT' AND "delivered_at" IS NULL))
);

CREATE TABLE "organization_integrations" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "created_by_id" UUID NOT NULL,
  "kind" "OrganizationIntegrationKind" NOT NULL,
  "name" VARCHAR(80) NOT NULL,
  "endpoint_ciphertext" TEXT NOT NULL,
  "secret_ciphertext" TEXT,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "organization_integrations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "organization_integrations_name_check" CHECK (length(btrim("name")) > 0),
  CONSTRAINT "organization_integrations_ciphertext_check" CHECK (length("endpoint_ciphertext") BETWEEN 40 AND 5000)
);

CREATE TABLE "challenge_instances" (
  "id" UUID NOT NULL,
  "assignment_item_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "status" "ChallengeInstanceStatus" NOT NULL DEFAULT 'STARTING',
  "provider_reference" VARCHAR(180),
  "connection_host" VARCHAR(253),
  "connection_port" INTEGER,
  "connection_protocol" "ChallengeConnectionProtocol",
  "idempotency_key" CHAR(64) NOT NULL,
  "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  "stopped_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "challenge_instances_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "challenge_instances_idempotency_check" CHECK ("idempotency_key" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "challenge_instances_expiry_check" CHECK ("expires_at" > "started_at"),
  CONSTRAINT "challenge_instances_connection_check" CHECK (("status" = 'RUNNING' AND "provider_reference" IS NOT NULL AND "connection_host" IS NOT NULL AND "connection_port" BETWEEN 1 AND 65535 AND "connection_protocol" IS NOT NULL) OR "status" <> 'RUNNING'),
  CONSTRAINT "challenge_instances_stopped_check" CHECK (("status" IN ('STOPPED', 'EXPIRED', 'FAILED') AND "stopped_at" IS NOT NULL) OR ("status" IN ('STARTING', 'RUNNING') AND "stopped_at" IS NULL))
);

CREATE TABLE "quiz_integrity_events" (
  "id" UUID NOT NULL,
  "attempt_id" UUID NOT NULL,
  "type" "QuizIntegrityEventType" NOT NULL,
  "dedupe_key" VARCHAR(120) NOT NULL,
  "client_ip_digest" CHAR(64),
  "detail" JSONB NOT NULL DEFAULT '{}',
  "occurred_at" TIMESTAMPTZ(6) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "quiz_integrity_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "quiz_integrity_events_ip_check" CHECK ("client_ip_digest" IS NULL OR "client_ip_digest" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "quiz_integrity_events_detail_check" CHECK (jsonb_typeof("detail") = 'object')
);

CREATE UNIQUE INDEX "web_push_subscriptions_endpoint_hash_key" ON "web_push_subscriptions"("endpoint_hash");
CREATE INDEX "web_push_subscriptions_user_id_created_at_idx" ON "web_push_subscriptions"("user_id", "created_at");
CREATE UNIQUE INDEX "notification_deliveries_notification_id_channel_key" ON "notification_deliveries"("notification_id", "channel");
CREATE INDEX "notification_deliveries_status_next_attempt_at_idx" ON "notification_deliveries"("status", "next_attempt_at");
CREATE UNIQUE INDEX "organization_integrations_organization_id_kind_name_key" ON "organization_integrations"("organization_id", "kind", "name");
CREATE INDEX "organization_integrations_organization_id_enabled_idx" ON "organization_integrations"("organization_id", "enabled");
CREATE UNIQUE INDEX "challenge_instances_provider_reference_key" ON "challenge_instances"("provider_reference");
CREATE UNIQUE INDEX "challenge_instances_idempotency_key_key" ON "challenge_instances"("idempotency_key");
CREATE INDEX "challenge_instances_assignment_item_id_user_id_status_idx" ON "challenge_instances"("assignment_item_id", "user_id", "status");
CREATE INDEX "challenge_instances_status_expires_at_idx" ON "challenge_instances"("status", "expires_at");
CREATE UNIQUE INDEX "quiz_integrity_events_attempt_id_dedupe_key_key" ON "quiz_integrity_events"("attempt_id", "dedupe_key");
CREATE INDEX "quiz_integrity_events_attempt_id_occurred_at_idx" ON "quiz_integrity_events"("attempt_id", "occurred_at");

ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "web_push_subscriptions" ADD CONSTRAINT "web_push_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "notifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "organization_integrations" ADD CONSTRAINT "organization_integrations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "organization_integrations" ADD CONSTRAINT "organization_integrations_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "challenge_instances" ADD CONSTRAINT "challenge_instances_assignment_item_id_fkey" FOREIGN KEY ("assignment_item_id") REFERENCES "internal_challenges"("assignment_item_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "challenge_instances" ADD CONSTRAINT "challenge_instances_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "quiz_integrity_events" ADD CONSTRAINT "quiz_integrity_events_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "quiz_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "notification_preferences" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "web_push_subscriptions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notification_deliveries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "organization_integrations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "challenge_instances" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "quiz_integrity_events" ENABLE ROW LEVEL SECURITY;
