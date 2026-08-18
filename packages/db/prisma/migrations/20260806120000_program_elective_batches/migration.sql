-- Program Elective (PE) batches, faculty, student assignments, and course config

-- Course PE config fields
ALTER TABLE "Course" ADD COLUMN IF NOT EXISTS "numberOfBatches" INTEGER;
ALTER TABLE "Course" ADD COLUMN IF NOT EXISTS "studentsPerBatch" INTEGER;
ALTER TABLE "Course" ADD COLUMN IF NOT EXISTS "electiveMappingVersion" INTEGER NOT NULL DEFAULT 1;

-- Make ClassSession.sectionId nullable for PE (section-less)
ALTER TABLE "ClassSession" ALTER COLUMN "sectionId" DROP NOT NULL;

-- Elective batch FKs on attendance/session tables
ALTER TABLE "Attendance" ADD COLUMN IF NOT EXISTS "electiveBatchId" TEXT;
ALTER TABLE "AttendanceRecord" ADD COLUMN IF NOT EXISTS "electiveBatchId" TEXT;
ALTER TABLE "ClassSession" ADD COLUMN IF NOT EXISTS "electiveBatchId" TEXT;

-- Drop old Attendance unique; recreate with electiveBatchId
ALTER TABLE "Attendance" DROP CONSTRAINT IF EXISTS "Attendance_studentId_courseId_batchId_key";
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_studentId_courseId_batchId_electiveBatchId_key" UNIQUE ("studentId", "courseId", "batchId", "electiveBatchId");

-- Drop old ClassSession unique; recreate with electiveBatchId
ALTER TABLE "ClassSession" DROP CONSTRAINT IF EXISTS "ClassSession_courseId_sectionId_sessionDate_timingCode_batchId_key";
ALTER TABLE "ClassSession" ADD CONSTRAINT "ClassSession_courseId_sectionId_sessionDate_timingCode_batchId_electiveBatchId_key" UNIQUE ("courseId", "sectionId", "sessionDate", "timingCode", "batchId", "electiveBatchId");

CREATE TABLE IF NOT EXISTS "ElectiveBatch" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ElectiveBatch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ElectiveBatchFaculty" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "electiveBatchId" TEXT NOT NULL,
    "facultyId" TEXT NOT NULL,
    "semester" INTEGER NOT NULL,
    "academicYear" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ElectiveBatchFaculty_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ElectiveStudentAssignment" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "electiveBatchId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ElectiveStudentAssignment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ElectiveBatch_courseId_name_key" ON "ElectiveBatch"("courseId", "name");
CREATE UNIQUE INDEX IF NOT EXISTS "ElectiveBatch_courseId_sortOrder_key" ON "ElectiveBatch"("courseId", "sortOrder");
CREATE INDEX IF NOT EXISTS "ElectiveBatch_courseId_idx" ON "ElectiveBatch"("courseId");

CREATE UNIQUE INDEX IF NOT EXISTS "ElectiveBatchFaculty_electiveBatchId_key" ON "ElectiveBatchFaculty"("electiveBatchId");
CREATE UNIQUE INDEX IF NOT EXISTS "ElectiveBatchFaculty_courseId_electiveBatchId_key" ON "ElectiveBatchFaculty"("courseId", "electiveBatchId");
CREATE INDEX IF NOT EXISTS "ElectiveBatchFaculty_facultyId_idx" ON "ElectiveBatchFaculty"("facultyId");
CREATE INDEX IF NOT EXISTS "ElectiveBatchFaculty_courseId_semester_academicYear_idx" ON "ElectiveBatchFaculty"("courseId", "semester", "academicYear");

CREATE UNIQUE INDEX IF NOT EXISTS "ElectiveStudentAssignment_studentId_courseId_key" ON "ElectiveStudentAssignment"("studentId", "courseId");
CREATE INDEX IF NOT EXISTS "ElectiveStudentAssignment_electiveBatchId_idx" ON "ElectiveStudentAssignment"("electiveBatchId");
CREATE INDEX IF NOT EXISTS "ElectiveStudentAssignment_courseId_idx" ON "ElectiveStudentAssignment"("courseId");

CREATE INDEX IF NOT EXISTS "Attendance_electiveBatchId_idx" ON "Attendance"("electiveBatchId");
CREATE INDEX IF NOT EXISTS "AttendanceRecord_electiveBatchId_idx" ON "AttendanceRecord"("electiveBatchId");
CREATE INDEX IF NOT EXISTS "ClassSession_electiveBatchId_idx" ON "ClassSession"("electiveBatchId");

ALTER TABLE "ElectiveBatch" DROP CONSTRAINT IF EXISTS "ElectiveBatch_courseId_fkey";
ALTER TABLE "ElectiveBatch" ADD CONSTRAINT "ElectiveBatch_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ElectiveBatchFaculty" DROP CONSTRAINT IF EXISTS "ElectiveBatchFaculty_courseId_fkey";
ALTER TABLE "ElectiveBatchFaculty" ADD CONSTRAINT "ElectiveBatchFaculty_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ElectiveBatchFaculty" DROP CONSTRAINT IF EXISTS "ElectiveBatchFaculty_electiveBatchId_fkey";
ALTER TABLE "ElectiveBatchFaculty" ADD CONSTRAINT "ElectiveBatchFaculty_electiveBatchId_fkey" FOREIGN KEY ("electiveBatchId") REFERENCES "ElectiveBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ElectiveBatchFaculty" DROP CONSTRAINT IF EXISTS "ElectiveBatchFaculty_facultyId_fkey";
ALTER TABLE "ElectiveBatchFaculty" ADD CONSTRAINT "ElectiveBatchFaculty_facultyId_fkey" FOREIGN KEY ("facultyId") REFERENCES "Faculty"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ElectiveStudentAssignment" DROP CONSTRAINT IF EXISTS "ElectiveStudentAssignment_courseId_fkey";
ALTER TABLE "ElectiveStudentAssignment" ADD CONSTRAINT "ElectiveStudentAssignment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ElectiveStudentAssignment" DROP CONSTRAINT IF EXISTS "ElectiveStudentAssignment_studentId_fkey";
ALTER TABLE "ElectiveStudentAssignment" ADD CONSTRAINT "ElectiveStudentAssignment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ElectiveStudentAssignment" DROP CONSTRAINT IF EXISTS "ElectiveStudentAssignment_electiveBatchId_fkey";
ALTER TABLE "ElectiveStudentAssignment" ADD CONSTRAINT "ElectiveStudentAssignment_electiveBatchId_fkey" FOREIGN KEY ("electiveBatchId") REFERENCES "ElectiveBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Attendance" DROP CONSTRAINT IF EXISTS "Attendance_electiveBatchId_fkey";
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_electiveBatchId_fkey" FOREIGN KEY ("electiveBatchId") REFERENCES "ElectiveBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AttendanceRecord" DROP CONSTRAINT IF EXISTS "AttendanceRecord_electiveBatchId_fkey";
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_electiveBatchId_fkey" FOREIGN KEY ("electiveBatchId") REFERENCES "ElectiveBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ClassSession" DROP CONSTRAINT IF EXISTS "ClassSession_electiveBatchId_fkey";
ALTER TABLE "ClassSession" ADD CONSTRAINT "ClassSession_electiveBatchId_fkey" FOREIGN KEY ("electiveBatchId") REFERENCES "ElectiveBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
