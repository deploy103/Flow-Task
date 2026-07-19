WITH "ranked_active_primary_relations" AS (
  SELECT "id", ROW_NUMBER() OVER (
    PARTITION BY "organization_id", "mentee_id"
    ORDER BY "started_at" DESC, "id" DESC
  ) AS "relation_rank"
  FROM "mentor_relations"
  WHERE "type" = 'PRIMARY' AND "ended_at" IS NULL
)
UPDATE "mentor_relations"
SET "type" = 'SECONDARY'
WHERE "id" IN (
  SELECT "id"
  FROM "ranked_active_primary_relations"
  WHERE "relation_rank" > 1
);

CREATE UNIQUE INDEX "mentor_relations_one_active_primary_per_mentee_key"
ON "mentor_relations"("organization_id", "mentee_id")
WHERE "type" = 'PRIMARY' AND "ended_at" IS NULL;
