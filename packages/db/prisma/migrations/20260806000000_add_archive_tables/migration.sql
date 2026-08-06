-- CreateTable
CREATE TABLE "ArchivedSemester" (
    "id" TEXT NOT NULL,
    "originalId" TEXT NOT NULL,
    "semesterNumber" INTEGER NOT NULL,
    "programType" "ProgramType" NOT NULL,
    "academicTermId" TEXT NOT NULL,
    "academicTermType" TEXT NOT NULL,
    "academicTermYear" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "snapshot" JSONB NOT NULL,
    "archivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archivedBy" TEXT NOT NULL,

    CONSTRAINT "ArchivedSemester_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArchivedDepartment" (
    "id" TEXT NOT NULL,
    "originalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "abbreviation" TEXT NOT NULL,
    "type" "DepartmentType" NOT NULL,
    "semesterId" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "archivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archivedBy" TEXT NOT NULL,

    CONSTRAINT "ArchivedDepartment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArchivedFaculty" (
    "id" TEXT NOT NULL,
    "originalId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "designation" "Designation" NOT NULL,
    "shortName" TEXT NOT NULL,
    "employeeId" TEXT,
    "semesterId" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "archivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archivedBy" TEXT NOT NULL,

    CONSTRAINT "ArchivedFaculty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArchivedAdmin" (
    "id" TEXT NOT NULL,
    "originalId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "semesterId" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "archivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archivedBy" TEXT NOT NULL,

    CONSTRAINT "ArchivedAdmin_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ArchivedSemester_originalId_idx" ON "ArchivedSemester"("originalId");

-- CreateIndex
CREATE INDEX "ArchivedSemester_academicTermId_idx" ON "ArchivedSemester"("academicTermId");

-- CreateIndex
CREATE INDEX "ArchivedSemester_archivedAt_idx" ON "ArchivedSemester"("archivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ArchivedSemester_originalId_archivedAt_key" ON "ArchivedSemester"("originalId", "archivedAt");

-- CreateIndex
CREATE INDEX "ArchivedDepartment_originalId_idx" ON "ArchivedDepartment"("originalId");

-- CreateIndex
CREATE INDEX "ArchivedDepartment_semesterId_idx" ON "ArchivedDepartment"("semesterId");

-- CreateIndex
CREATE INDEX "ArchivedDepartment_archivedAt_idx" ON "ArchivedDepartment"("archivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ArchivedDepartment_originalId_semesterId_archivedAt_key" ON "ArchivedDepartment"("originalId", "semesterId", "archivedAt");

-- CreateIndex
CREATE INDEX "ArchivedFaculty_originalId_idx" ON "ArchivedFaculty"("originalId");

-- CreateIndex
CREATE INDEX "ArchivedFaculty_semesterId_idx" ON "ArchivedFaculty"("semesterId");

-- CreateIndex
CREATE INDEX "ArchivedFaculty_departmentId_idx" ON "ArchivedFaculty"("departmentId");

-- CreateIndex
CREATE INDEX "ArchivedFaculty_archivedAt_idx" ON "ArchivedFaculty"("archivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ArchivedFaculty_originalId_semesterId_archivedAt_key" ON "ArchivedFaculty"("originalId", "semesterId", "archivedAt");

-- CreateIndex
CREATE INDEX "ArchivedAdmin_originalId_idx" ON "ArchivedAdmin"("originalId");

-- CreateIndex
CREATE INDEX "ArchivedAdmin_semesterId_idx" ON "ArchivedAdmin"("semesterId");

-- CreateIndex
CREATE INDEX "ArchivedAdmin_archivedAt_idx" ON "ArchivedAdmin"("archivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ArchivedAdmin_originalId_semesterId_archivedAt_key" ON "ArchivedAdmin"("originalId", "semesterId", "archivedAt");
