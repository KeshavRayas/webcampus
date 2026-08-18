-- Archive snapshots for PE elective data (batch / faculty / student assignments)
-- Preserves elective rows when courses are deleted after a semester is archived.

-- CreateTable
CREATE TABLE "ArchivedElectiveBatch" (
    "id" TEXT NOT NULL,
    "originalId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "courseCode" TEXT NOT NULL,
    "courseName" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "semesterId" TEXT NOT NULL,
    "archivedDepartmentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "snapshot" JSONB NOT NULL,
    "archivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archivedBy" TEXT NOT NULL,

    CONSTRAINT "ArchivedElectiveBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArchivedElectiveBatchFaculty" (
    "id" TEXT NOT NULL,
    "originalId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "courseCode" TEXT NOT NULL,
    "courseName" TEXT NOT NULL,
    "batchName" TEXT NOT NULL,
    "facultyId" TEXT NOT NULL,
    "facultyName" TEXT NOT NULL,
    "semester" INTEGER NOT NULL,
    "academicYear" TEXT NOT NULL,
    "semesterId" TEXT NOT NULL,
    "archivedDepartmentId" TEXT,
    "snapshot" JSONB NOT NULL,
    "archivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archivedBy" TEXT NOT NULL,

    CONSTRAINT "ArchivedElectiveBatchFaculty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArchivedElectiveAssignment" (
    "id" TEXT NOT NULL,
    "originalId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "courseCode" TEXT NOT NULL,
    "courseName" TEXT NOT NULL,
    "batchName" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "usn" TEXT NOT NULL,
    "studentName" TEXT NOT NULL,
    "semesterId" TEXT NOT NULL,
    "archivedDepartmentId" TEXT,
    "snapshot" JSONB NOT NULL,
    "archivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archivedBy" TEXT NOT NULL,

    CONSTRAINT "ArchivedElectiveAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ArchivedElectiveBatch_originalId_semesterId_archivedAt_key" ON "ArchivedElectiveBatch"("originalId", "semesterId", "archivedAt");
CREATE INDEX "ArchivedElectiveBatch_originalId_idx" ON "ArchivedElectiveBatch"("originalId");
CREATE INDEX "ArchivedElectiveBatch_semesterId_idx" ON "ArchivedElectiveBatch"("semesterId");
CREATE INDEX "ArchivedElectiveBatch_courseId_idx" ON "ArchivedElectiveBatch"("courseId");
CREATE INDEX "ArchivedElectiveBatch_archivedDepartmentId_idx" ON "ArchivedElectiveBatch"("archivedDepartmentId");
CREATE INDEX "ArchivedElectiveBatch_archivedAt_idx" ON "ArchivedElectiveBatch"("archivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ArchivedElectiveBatchFaculty_originalId_semesterId_archivedAt_key" ON "ArchivedElectiveBatchFaculty"("originalId", "semesterId", "archivedAt");
CREATE INDEX "ArchivedElectiveBatchFaculty_originalId_idx" ON "ArchivedElectiveBatchFaculty"("originalId");
CREATE INDEX "ArchivedElectiveBatchFaculty_semesterId_idx" ON "ArchivedElectiveBatchFaculty"("semesterId");
CREATE INDEX "ArchivedElectiveBatchFaculty_courseId_idx" ON "ArchivedElectiveBatchFaculty"("courseId");
CREATE INDEX "ArchivedElectiveBatchFaculty_facultyId_idx" ON "ArchivedElectiveBatchFaculty"("facultyId");
CREATE INDEX "ArchivedElectiveBatchFaculty_archivedDepartmentId_idx" ON "ArchivedElectiveBatchFaculty"("archivedDepartmentId");
CREATE INDEX "ArchivedElectiveBatchFaculty_archivedAt_idx" ON "ArchivedElectiveBatchFaculty"("archivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ArchivedElectiveAssignment_originalId_semesterId_archivedAt_key" ON "ArchivedElectiveAssignment"("originalId", "semesterId", "archivedAt");
CREATE INDEX "ArchivedElectiveAssignment_originalId_idx" ON "ArchivedElectiveAssignment"("originalId");
CREATE INDEX "ArchivedElectiveAssignment_semesterId_idx" ON "ArchivedElectiveAssignment"("semesterId");
CREATE INDEX "ArchivedElectiveAssignment_courseId_idx" ON "ArchivedElectiveAssignment"("courseId");
CREATE INDEX "ArchivedElectiveAssignment_studentId_idx" ON "ArchivedElectiveAssignment"("studentId");
CREATE INDEX "ArchivedElectiveAssignment_archivedDepartmentId_idx" ON "ArchivedElectiveAssignment"("archivedDepartmentId");
CREATE INDEX "ArchivedElectiveAssignment_archivedAt_idx" ON "ArchivedElectiveAssignment"("archivedAt");
