UPDATE "ClassSession"
SET
  "timingCode" = COALESCE("timingCode", '08:00-08:55'),
  "timingLabel" = COALESCE("timingLabel", '08:00 AM - 08:55 AM'),
  "timingStartTime" = COALESCE("timingStartTime", '08:00'),
  "timingEndTime" = COALESCE("timingEndTime", '08:55')
WHERE
  "timingCode" IS NULL
  OR "timingLabel" IS NULL
  OR "timingStartTime" IS NULL
  OR "timingEndTime" IS NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "ClassSession"
    WHERE
      "timingCode" IS NULL
      OR "timingLabel" IS NULL
      OR "timingStartTime" IS NULL
      OR "timingEndTime" IS NULL
  ) THEN
    RAISE EXCEPTION 'ClassSession timing backfill incomplete';
  END IF;
END $$;