CREATE TYPE "NotificationType" AS ENUM ('ANNOUNCEMENT_CREATED', 'ASSIGNMENT_CREATED', 'DEADLINE_APPROACHING', 'MISSING_SUBMISSION', 'RESUBMIT_REQUIRED', 'SUBMISSION_APPROVED');
CREATE TYPE "CalendarEventType" AS ENUM ('CLASS', 'MEETING', 'EVENT');

CREATE TABLE "notifications" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "organization_id" UUID,
  "type" "NotificationType" NOT NULL,
  "title" VARCHAR(120) NOT NULL,
  "body" VARCHAR(500) NOT NULL,
  "href" VARCHAR(500) NOT NULL,
  "dedupe_key" VARCHAR(180) NOT NULL,
  "read_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "calendar_events" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "created_by_id" UUID NOT NULL,
  "type" "CalendarEventType" NOT NULL,
  "title" VARCHAR(100) NOT NULL,
  "description" VARCHAR(1000),
  "starts_at" TIMESTAMPTZ(6) NOT NULL,
  "ends_at" TIMESTAMPTZ(6) NOT NULL,
  "archived_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "calendar_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "calendar_events_time_order" CHECK ("starts_at" < "ends_at")
);

CREATE UNIQUE INDEX "notifications_user_id_dedupe_key_key" ON "notifications"("user_id", "dedupe_key");
CREATE INDEX "notifications_user_id_read_at_created_at_idx" ON "notifications"("user_id", "read_at", "created_at");
CREATE INDEX "notifications_organization_id_created_at_idx" ON "notifications"("organization_id", "created_at");
CREATE INDEX "calendar_events_organization_id_starts_at_ends_at_idx" ON "calendar_events"("organization_id", "starts_at", "ends_at");
CREATE INDEX "calendar_events_created_by_id_created_at_idx" ON "calendar_events"("created_by_id", "created_at");

ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "calendar_events" ENABLE ROW LEVEL SECURITY;
