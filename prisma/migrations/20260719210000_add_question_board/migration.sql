CREATE TYPE "QuestionBoardType" AS ENUM ('PUBLIC_QNA', 'MENTOR_QNA', 'PRIVATE_MENTOR');
ALTER TYPE "NotificationType" ADD VALUE 'QUESTION_CREATED';
ALTER TYPE "NotificationType" ADD VALUE 'QUESTION_ANSWERED';
ALTER TYPE "NotificationType" ADD VALUE 'QUESTION_ASSIGNED';
ALTER TYPE "NotificationType" ADD VALUE 'ANSWER_ACCEPTED';
CREATE TYPE "QuestionCategory" AS ENUM ('WEB', 'SYSTEM', 'REVERSING', 'FORENSICS', 'CRYPTOGRAPHY', 'NETWORK', 'PROGRAMMING', 'ASSIGNMENT', 'OTHER');
CREATE TYPE "QuestionStatus" AS ENUM ('WAITING', 'IN_PROGRESS', 'NEEDS_INFO', 'RESOLVED', 'CLOSED');
CREATE TYPE "MentorRelationType" AS ENUM ('PRIMARY', 'SECONDARY');

CREATE TABLE "mentor_relations" (
  "id" UUID NOT NULL, "organization_id" UUID NOT NULL, "mentor_id" UUID NOT NULL,
  "mentee_id" UUID NOT NULL, "type" "MentorRelationType" NOT NULL DEFAULT 'SECONDARY',
  "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, "ended_at" TIMESTAMPTZ(6),
  CONSTRAINT "mentor_relations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "mentor_relations_different_users" CHECK ("mentor_id" <> "mentee_id")
);

CREATE TABLE "questions" (
  "id" UUID NOT NULL, "organization_id" UUID NOT NULL, "author_id" UUID NOT NULL,
  "assigned_mentor_id" UUID, "related_assignment_id" UUID, "board_type" "QuestionBoardType" NOT NULL,
  "category" "QuestionCategory" NOT NULL, "status" "QuestionStatus" NOT NULL DEFAULT 'WAITING',
  "title" VARCHAR(120) NOT NULL, "content" TEXT NOT NULL, "attempted" TEXT, "error_message" TEXT,
  "code" TEXT, "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL, "closed_at" TIMESTAMPTZ(6), "hidden_at" TIMESTAMPTZ(6),
  CONSTRAINT "questions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "question_answers" (
  "id" UUID NOT NULL, "question_id" UUID NOT NULL, "author_id" UUID NOT NULL, "parent_id" UUID,
  "content" TEXT NOT NULL, "code" TEXT, "is_accepted" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, "edited_at" TIMESTAMPTZ(6), "hidden_at" TIMESTAMPTZ(6),
  CONSTRAINT "question_answers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "question_attachments" (
  "id" UUID NOT NULL, "question_id" UUID, "answer_id" UUID, "storage_path" VARCHAR(500) NOT NULL,
  "original_filename" VARCHAR(255) NOT NULL, "mime_type" VARCHAR(100) NOT NULL, "size_bytes" INTEGER NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "question_attachments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "question_attachments_exactly_one_parent" CHECK (("question_id" IS NOT NULL)::int + ("answer_id" IS NOT NULL)::int = 1),
  CONSTRAINT "question_attachments_size" CHECK ("size_bytes" > 0 AND "size_bytes" <= 524288)
);

CREATE UNIQUE INDEX "mentor_relations_organization_id_mentor_id_mentee_id_key" ON "mentor_relations"("organization_id", "mentor_id", "mentee_id");
CREATE INDEX "mentor_relations_organization_id_mentee_id_type_ended_at_idx" ON "mentor_relations"("organization_id", "mentee_id", "type", "ended_at");
CREATE INDEX "mentor_relations_organization_id_mentor_id_ended_at_idx" ON "mentor_relations"("organization_id", "mentor_id", "ended_at");
CREATE INDEX "questions_organization_id_board_type_status_created_at_idx" ON "questions"("organization_id", "board_type", "status", "created_at");
CREATE INDEX "questions_author_id_created_at_idx" ON "questions"("author_id", "created_at");
CREATE INDEX "questions_assigned_mentor_id_status_created_at_idx" ON "questions"("assigned_mentor_id", "status", "created_at");
CREATE INDEX "question_answers_question_id_created_at_idx" ON "question_answers"("question_id", "created_at");
CREATE INDEX "question_answers_author_id_created_at_idx" ON "question_answers"("author_id", "created_at");
CREATE UNIQUE INDEX "question_attachments_storage_path_key" ON "question_attachments"("storage_path");
CREATE INDEX "question_attachments_question_id_idx" ON "question_attachments"("question_id");
CREATE INDEX "question_attachments_answer_id_idx" ON "question_attachments"("answer_id");

ALTER TABLE "mentor_relations" ADD CONSTRAINT "mentor_relations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "mentor_relations" ADD CONSTRAINT "mentor_relations_mentor_id_fkey" FOREIGN KEY ("mentor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "mentor_relations" ADD CONSTRAINT "mentor_relations_mentee_id_fkey" FOREIGN KEY ("mentee_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "questions" ADD CONSTRAINT "questions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "questions" ADD CONSTRAINT "questions_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "questions" ADD CONSTRAINT "questions_assigned_mentor_id_fkey" FOREIGN KEY ("assigned_mentor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "questions" ADD CONSTRAINT "questions_related_assignment_id_fkey" FOREIGN KEY ("related_assignment_id") REFERENCES "assignments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "question_answers" ADD CONSTRAINT "question_answers_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "question_answers" ADD CONSTRAINT "question_answers_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "question_answers" ADD CONSTRAINT "question_answers_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "question_answers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "question_attachments" ADD CONSTRAINT "question_attachments_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "question_attachments" ADD CONSTRAINT "question_attachments_answer_id_fkey" FOREIGN KEY ("answer_id") REFERENCES "question_answers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "mentor_relations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "questions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "question_answers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "question_attachments" ENABLE ROW LEVEL SECURITY;
