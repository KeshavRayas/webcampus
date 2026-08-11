-- Open Elective (OE) visibility configuration

-- OE eligibility enum
CREATE TYPE "OpenElectiveEligibility" AS ENUM ('ALL', 'ALL_EXCEPT_OWNER', 'CUSTOM');

-- Course OE config field (default ALL = visible to every department)
ALTER TABLE "Course" ADD COLUMN IF NOT EXISTS "openElectiveEligibility" "OpenElectiveEligibility" NOT NULL DEFAULT 'ALL';

-- Normalized visibility table (rows exist only for CUSTOM mode)
CREATE TABLE IF NOT EXISTS "OpenElectiveDepartment" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OpenElectiveDepartment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "OpenElectiveDepartment_courseId_departmentId_key" ON "OpenElectiveDepartment"("courseId", "departmentId");
CREATE INDEX IF NOT EXISTS "OpenElectiveDepartment_departmentId_idx" ON "OpenElectiveDepartment"("departmentId");
CREATE INDEX IF NOT EXISTS "OpenElectiveDepartment_courseId_idx" ON "OpenElectiveDepartment"("courseId");

ALTER TABLE "OpenElectiveDepartment" DROP CONSTRAINT IF EXISTS "OpenElectiveDepartment_courseId_fkey";
ALTER TABLE "OpenElectiveDepartment" ADD CONSTRAINT "OpenElectiveDepartment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OpenElectiveDepartment" DROP CONSTRAINT IF EXISTS "OpenElectiveDepartment_departmentId_fkey";
ALTER TABLE "OpenElectiveDepartment" ADD CONSTRAINT "OpenElectiveDepartment_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;
