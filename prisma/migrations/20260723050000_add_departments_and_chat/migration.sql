CREATE TYPE "DepartmentRole" AS ENUM ('MEMBER', 'LEAD');

CREATE TABLE "departments" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "name" VARCHAR(80) NOT NULL,
  "description" VARCHAR(500),
  "created_by_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  "archived_at" TIMESTAMPTZ(6),
  CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "department_members" (
  "department_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "role" "DepartmentRole" NOT NULL DEFAULT 'MEMBER',
  "joined_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "department_members_pkey" PRIMARY KEY ("department_id", "user_id")
);

CREATE TABLE "department_messages" (
  "id" UUID NOT NULL,
  "department_id" UUID NOT NULL,
  "author_id" UUID NOT NULL,
  "content" VARCHAR(2000) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "department_messages_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "departments_organization_id_name_key" ON "departments"("organization_id", "name");
CREATE INDEX "departments_organization_id_archived_at_idx" ON "departments"("organization_id", "archived_at");
CREATE INDEX "department_members_user_id_department_id_idx" ON "department_members"("user_id", "department_id");
CREATE UNIQUE INDEX "department_members_single_lead_idx" ON "department_members"("department_id") WHERE "role" = 'LEAD';
CREATE INDEX "department_messages_department_id_created_at_idx" ON "department_messages"("department_id", "created_at");

ALTER TABLE "departments" ADD CONSTRAINT "departments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "departments" ADD CONSTRAINT "departments_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "department_members" ADD CONSTRAINT "department_members_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "department_members" ADD CONSTRAINT "department_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "department_messages" ADD CONSTRAINT "department_messages_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "department_messages" ADD CONSTRAINT "department_messages_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "departments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "department_members" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "department_messages" ENABLE ROW LEVEL SECURITY;
