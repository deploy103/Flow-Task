CREATE TYPE "AssignmentAudience" AS ENUM ('ALL_MEMBERS', 'SELECTED_MEMBERS');
CREATE TYPE "AssignmentFieldType" AS ENUM ('TEXT', 'FILE', 'LINK');

CREATE TABLE "assignments" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "created_by_id" UUID NOT NULL,
  "title" VARCHAR(100) NOT NULL,
  "description" TEXT NOT NULL,
  "audience" "AssignmentAudience" NOT NULL DEFAULT 'ALL_MEMBERS',
  "opens_at" TIMESTAMPTZ(6) NOT NULL,
  "deadline" TIMESTAMPTZ(6) NOT NULL,
  "allow_late" BOOLEAN NOT NULL DEFAULT false,
  "archived_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "assignments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "assignment_targets" (
  "assignment_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  CONSTRAINT "assignment_targets_pkey" PRIMARY KEY ("assignment_id", "user_id")
);

CREATE TABLE "assignment_fields" (
  "id" UUID NOT NULL,
  "assignment_id" UUID NOT NULL,
  "type" "AssignmentFieldType" NOT NULL,
  "label" VARCHAR(80) NOT NULL,
  "required" BOOLEAN NOT NULL DEFAULT true,
  "position" INTEGER NOT NULL,
  CONSTRAINT "assignment_fields_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "assignments_organization_id_opens_at_deadline_idx" ON "assignments"("organization_id", "opens_at", "deadline");
CREATE INDEX "assignment_targets_user_id_idx" ON "assignment_targets"("user_id");
CREATE UNIQUE INDEX "assignment_fields_assignment_id_position_key" ON "assignment_fields"("assignment_id", "position");
CREATE UNIQUE INDEX "assignment_fields_assignment_id_type_key" ON "assignment_fields"("assignment_id", "type");

ALTER TABLE "assignments" ADD CONSTRAINT "assignments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "assignment_targets" ADD CONSTRAINT "assignment_targets_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "assignment_targets" ADD CONSTRAINT "assignment_targets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "assignment_fields" ADD CONSTRAINT "assignment_fields_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "assignments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "assignment_targets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "assignment_fields" ENABLE ROW LEVEL SECURITY;
