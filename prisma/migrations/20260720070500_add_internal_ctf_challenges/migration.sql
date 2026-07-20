ALTER TYPE "AssignmentItemType" ADD VALUE 'INTERNAL_CTF';

CREATE TYPE "InternalChallengeMode" AS ENUM ('STATIC_FILE', 'SHARED_SERVER');
CREATE TYPE "ChallengeConnectionProtocol" AS ENUM ('HTTPS', 'HTTP', 'TCP', 'SSH');

CREATE TABLE "internal_challenges" (
  "assignment_item_id" UUID NOT NULL,
  "title" VARCHAR(160) NOT NULL,
  "description" TEXT NOT NULL,
  "category" "ChallengeCategory" NOT NULL,
  "difficulty" VARCHAR(40) NOT NULL,
  "points" INTEGER NOT NULL,
  "mode" "InternalChallengeMode" NOT NULL,
  "protocol" "ChallengeConnectionProtocol",
  "host" VARCHAR(253),
  "port" INTEGER,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "internal_challenges_pkey" PRIMARY KEY ("assignment_item_id"),
  CONSTRAINT "internal_challenges_title_check" CHECK (length(btrim("title")) > 0),
  CONSTRAINT "internal_challenges_description_check" CHECK (length(btrim("description")) > 0 AND length("description") <= 20000),
  CONSTRAINT "internal_challenges_difficulty_check" CHECK (length(btrim("difficulty")) > 0),
  CONSTRAINT "internal_challenges_points_check" CHECK ("points" >= 0 AND "points" <= 100000),
  CONSTRAINT "internal_challenges_connection_check" CHECK (
    ("mode" = 'STATIC_FILE' AND "protocol" IS NULL AND "host" IS NULL AND "port" IS NULL)
    OR
    ("mode" = 'SHARED_SERVER' AND "protocol" IS NOT NULL AND "host" IS NOT NULL AND length(btrim("host")) > 0 AND "port" BETWEEN 1 AND 65535)
  )
);

CREATE TABLE "challenge_hints" (
  "id" UUID NOT NULL,
  "assignment_item_id" UUID NOT NULL,
  "content" VARCHAR(1000) NOT NULL,
  "position" INTEGER NOT NULL,
  CONSTRAINT "challenge_hints_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "challenge_hints_content_check" CHECK (length(btrim("content")) > 0),
  CONSTRAINT "challenge_hints_position_check" CHECK ("position" >= 0)
);

CREATE TABLE "challenge_resources" (
  "id" UUID NOT NULL,
  "assignment_item_id" UUID NOT NULL,
  "storage_path" VARCHAR(500) NOT NULL,
  "original_filename" VARCHAR(255) NOT NULL,
  "mime_type" VARCHAR(150) NOT NULL,
  "size_bytes" BIGINT NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "challenge_resources_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "challenge_resources_size_check" CHECK ("size_bytes" > 0 AND "size_bytes" <= 524288),
  CONSTRAINT "challenge_resources_filename_check" CHECK (length(btrim("original_filename")) > 0)
);

CREATE INDEX "internal_challenges_mode_category_idx" ON "internal_challenges"("mode", "category");
CREATE UNIQUE INDEX "challenge_hints_assignment_item_id_position_key" ON "challenge_hints"("assignment_item_id", "position");
CREATE UNIQUE INDEX "challenge_resources_storage_path_key" ON "challenge_resources"("storage_path");
CREATE INDEX "challenge_resources_assignment_item_id_idx" ON "challenge_resources"("assignment_item_id");

ALTER TABLE "internal_challenges" ADD CONSTRAINT "internal_challenges_assignment_item_id_fkey"
FOREIGN KEY ("assignment_item_id") REFERENCES "assignment_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "challenge_hints" ADD CONSTRAINT "challenge_hints_assignment_item_id_fkey"
FOREIGN KEY ("assignment_item_id") REFERENCES "internal_challenges"("assignment_item_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "challenge_resources" ADD CONSTRAINT "challenge_resources_assignment_item_id_fkey"
FOREIGN KEY ("assignment_item_id") REFERENCES "internal_challenges"("assignment_item_id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "internal_challenges" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "challenge_hints" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "challenge_resources" ENABLE ROW LEVEL SECURITY;
