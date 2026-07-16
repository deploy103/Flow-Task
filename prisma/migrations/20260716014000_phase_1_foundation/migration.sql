CREATE TYPE "SystemRole" AS ENUM ('USER', 'SYSTEM_ADMIN');
CREATE TYPE "MembershipRole" AS ENUM ('MEMBER', 'MENTOR', 'ORG_ADMIN');
CREATE TYPE "MembershipStatus" AS ENUM ('ACTIVE', 'INACTIVE');

CREATE TABLE "users" (
  "id" UUID NOT NULL,
  "email" VARCHAR(320) NOT NULL,
  "name" VARCHAR(50) NOT NULL,
  "student_number" VARCHAR(30),
  "system_role" "SystemRole" NOT NULL DEFAULT 'USER',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "organizations" (
  "id" UUID NOT NULL,
  "name" VARCHAR(80) NOT NULL,
  "description" VARCHAR(500),
  "created_by_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  "archived_at" TIMESTAMPTZ(6),
  CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "organization_members" (
  "organization_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "role" "MembershipRole" NOT NULL DEFAULT 'MEMBER',
  "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
  "joined_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "organization_members_pkey" PRIMARY KEY ("organization_id", "user_id")
);

CREATE TABLE "organization_invites" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "code_hash" CHAR(64) NOT NULL,
  "role" "MembershipRole" NOT NULL DEFAULT 'MEMBER',
  "max_uses" INTEGER,
  "used_count" INTEGER NOT NULL DEFAULT 0,
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  "created_by_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revoked_at" TIMESTAMPTZ(6),
  CONSTRAINT "organization_invites_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "audit_logs" (
  "id" BIGSERIAL NOT NULL,
  "actor_id" UUID NOT NULL,
  "organization_id" UUID,
  "action" VARCHAR(80) NOT NULL,
  "target_type" VARCHAR(50) NOT NULL,
  "target_id" VARCHAR(100),
  "metadata" JSONB,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE INDEX "organizations_created_by_id_idx" ON "organizations"("created_by_id");
CREATE INDEX "organization_members_user_id_status_idx" ON "organization_members"("user_id", "status");
CREATE UNIQUE INDEX "organization_invites_code_hash_key" ON "organization_invites"("code_hash");
CREATE INDEX "organization_invites_organization_id_expires_at_idx" ON "organization_invites"("organization_id", "expires_at");
CREATE INDEX "audit_logs_organization_id_created_at_idx" ON "audit_logs"("organization_id", "created_at");
CREATE INDEX "audit_logs_actor_id_created_at_idx" ON "audit_logs"("actor_id", "created_at");

ALTER TABLE "organizations" ADD CONSTRAINT "organizations_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "organization_invites" ADD CONSTRAINT "organization_invites_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "organization_invites" ADD CONSTRAINT "organization_invites_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- The browser-side Supabase client is used only for Auth. Direct Data API access
-- to application tables is denied; trusted server queries use Prisma.
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "organizations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "organization_members" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "organization_invites" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;
