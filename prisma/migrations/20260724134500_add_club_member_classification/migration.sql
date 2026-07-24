CREATE TYPE "ClubPosition" AS ENUM ('PRESIDENT', 'VICE_PRESIDENT', 'MEMBER');
CREATE TYPE "SecurityTrack" AS ENUM ('PWNABLE', 'WEB', 'FORENSICS', 'CRYPTOGRAPHY', 'REVERSING', 'MISCELLANEOUS');
CREATE TYPE "MentoringRole" AS ENUM ('MENTOR', 'MENTEE', 'NONE');

ALTER TABLE "organization_members"
ADD COLUMN "position" "ClubPosition" NOT NULL DEFAULT 'MEMBER',
ADD COLUMN "security_track" "SecurityTrack",
ADD COLUMN "mentoring_role" "MentoringRole" NOT NULL DEFAULT 'MENTEE';

UPDATE "organization_members"
SET
  "position" = CASE
    WHEN "role" = 'ORG_ADMIN' THEN 'PRESIDENT'::"ClubPosition"
    ELSE 'MEMBER'::"ClubPosition"
  END,
  "mentoring_role" = CASE
    WHEN "role" = 'MENTOR' THEN 'MENTOR'::"MentoringRole"
    WHEN "role" = 'MEMBER' THEN 'MENTEE'::"MentoringRole"
    ELSE 'NONE'::"MentoringRole"
  END;

CREATE INDEX "organization_members_organization_id_security_track_mentoring_role_status_idx"
ON "organization_members"("organization_id", "security_track", "mentoring_role", "status");
