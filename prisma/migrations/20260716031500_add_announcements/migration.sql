CREATE TYPE "AnnouncementPriority" AS ENUM ('NORMAL', 'IMPORTANT');
CREATE TYPE "AnnouncementAudience" AS ENUM ('ALL_MEMBERS', 'SELECTED_MEMBERS');

CREATE TABLE "announcements" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "author_id" UUID NOT NULL,
  "title" VARCHAR(100) NOT NULL,
  "content" TEXT NOT NULL,
  "priority" "AnnouncementPriority" NOT NULL DEFAULT 'NORMAL',
  "audience" "AnnouncementAudience" NOT NULL DEFAULT 'ALL_MEMBERS',
  "published_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMPTZ(6),
  "archived_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "announcements_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "announcement_targets" (
  "announcement_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  CONSTRAINT "announcement_targets_pkey" PRIMARY KEY ("announcement_id", "user_id")
);

CREATE TABLE "announcement_reads" (
  "announcement_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "confirmed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "announcement_reads_pkey" PRIMARY KEY ("announcement_id", "user_id")
);

CREATE INDEX "announcements_organization_id_published_at_idx" ON "announcements"("organization_id", "published_at");
CREATE INDEX "announcement_targets_user_id_idx" ON "announcement_targets"("user_id");
CREATE INDEX "announcement_reads_user_id_confirmed_at_idx" ON "announcement_reads"("user_id", "confirmed_at");

ALTER TABLE "announcements" ADD CONSTRAINT "announcements_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "announcement_targets" ADD CONSTRAINT "announcement_targets_announcement_id_fkey" FOREIGN KEY ("announcement_id") REFERENCES "announcements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "announcement_targets" ADD CONSTRAINT "announcement_targets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "announcement_reads" ADD CONSTRAINT "announcement_reads_announcement_id_fkey" FOREIGN KEY ("announcement_id") REFERENCES "announcements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "announcement_reads" ADD CONSTRAINT "announcement_reads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "announcements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "announcement_targets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "announcement_reads" ENABLE ROW LEVEL SECURITY;
