ALTER TABLE "ClassSession"
ADD COLUMN "timingCode" TEXT,
ADD COLUMN "timingLabel" TEXT,
ADD COLUMN "timingStartTime" TEXT,
ADD COLUMN "timingEndTime" TEXT;

UPDATE "ClassSession"
SET
  "timingCode" = CASE "sessionNumber"
    WHEN 1 THEN '08:00-08:55'
    WHEN 2 THEN '08:55-09:50'
    WHEN 3 THEN '09:50-10:45'
    WHEN 4 THEN '11:15-12:10'
    WHEN 5 THEN '12:10-13:05'
    WHEN 6 THEN '14:00-14:55'
    WHEN 7 THEN '14:55-15:50'
    WHEN 8 THEN '15:50-16:45'
    ELSE '08:00-08:55'
  END,
  "timingLabel" = CASE "sessionNumber"
    WHEN 1 THEN '08:00 AM - 08:55 AM'
    WHEN 2 THEN '08:55 AM - 09:50 AM'
    WHEN 3 THEN '09:50 AM - 10:45 AM'
    WHEN 4 THEN '11:15 AM - 12:10 PM'
    WHEN 5 THEN '12:10 PM - 01:05 PM'
    WHEN 6 THEN '02:00 PM - 02:55 PM'
    WHEN 7 THEN '02:55 PM - 03:50 PM'
    WHEN 8 THEN '03:50 PM - 04:45 PM'
    ELSE '08:00 AM - 08:55 AM'
  END,
  "timingStartTime" = CASE "sessionNumber"
    WHEN 1 THEN '08:00'
    WHEN 2 THEN '08:55'
    WHEN 3 THEN '09:50'
    WHEN 4 THEN '11:15'
    WHEN 5 THEN '12:10'
    WHEN 6 THEN '14:00'
    WHEN 7 THEN '14:55'
    WHEN 8 THEN '15:50'
    ELSE '08:00'
  END,
  "timingEndTime" = CASE "sessionNumber"
    WHEN 1 THEN '08:55'
    WHEN 2 THEN '09:50'
    WHEN 3 THEN '10:45'
    WHEN 4 THEN '12:10'
    WHEN 5 THEN '13:05'
    WHEN 6 THEN '14:55'
    WHEN 7 THEN '15:50'
    WHEN 8 THEN '16:45'
    ELSE '08:55'
  END;

ALTER TABLE "ClassSession" ALTER COLUMN "timingCode" SET NOT NULL;
ALTER TABLE "ClassSession" ALTER COLUMN "timingLabel" SET NOT NULL;
ALTER TABLE "ClassSession" ALTER COLUMN "timingStartTime" SET NOT NULL;
ALTER TABLE "ClassSession" ALTER COLUMN "timingEndTime" SET NOT NULL;

CREATE UNIQUE INDEX "ClassSession_courseId_sectionId_sessionDate_timingCode_key" ON "ClassSession"("courseId", "sectionId", "sessionDate", "timingCode");

DROP INDEX "ClassSession_courseId_sectionId_sessionDate_sessionNumber_key";
ALTER TABLE "ClassSession" DROP COLUMN "sessionNumber";