-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "proctorGroupId" TEXT;

-- CreateTable
CREATE TABLE "BonusAttendanceWindow" (
    "id" TEXT NOT NULL,
    "academicTermId" TEXT NOT NULL,
    "semesterId" TEXT NOT NULL,
    "departmentId" TEXT,
    "cycle" "Cycle",
    "days" INTEGER NOT NULL DEFAULT 1,
    "isOpen" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BonusAttendanceWindow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProctorGroup" (
    "id" TEXT NOT NULL,
    "groupNumber" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "facultyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProctorGroup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BonusAttendanceWindow_academicTermId_semesterId_idx" ON "BonusAttendanceWindow"("academicTermId", "semesterId");

-- CreateIndex
CREATE UNIQUE INDEX "BonusAttendanceWindow_academicTermId_semesterId_departmentI_key" ON "BonusAttendanceWindow"("academicTermId", "semesterId", "departmentId", "cycle");

-- CreateIndex
CREATE INDEX "ProctorGroup_departmentId_idx" ON "ProctorGroup"("departmentId");

-- CreateIndex
CREATE INDEX "ProctorGroup_facultyId_idx" ON "ProctorGroup"("facultyId");

-- CreateIndex
CREATE UNIQUE INDEX "ProctorGroup_departmentId_groupNumber_key" ON "ProctorGroup"("departmentId", "groupNumber");

-- AddForeignKey
ALTER TABLE "BonusAttendanceWindow" ADD CONSTRAINT "BonusAttendanceWindow_academicTermId_fkey" FOREIGN KEY ("academicTermId") REFERENCES "AcademicTerm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BonusAttendanceWindow" ADD CONSTRAINT "BonusAttendanceWindow_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "Semester"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BonusAttendanceWindow" ADD CONSTRAINT "BonusAttendanceWindow_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_proctorGroupId_fkey" FOREIGN KEY ("proctorGroupId") REFERENCES "ProctorGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProctorGroup" ADD CONSTRAINT "ProctorGroup_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProctorGroup" ADD CONSTRAINT "ProctorGroup_facultyId_fkey" FOREIGN KEY ("facultyId") REFERENCES "Faculty"("id") ON DELETE SET NULL ON UPDATE CASCADE;
