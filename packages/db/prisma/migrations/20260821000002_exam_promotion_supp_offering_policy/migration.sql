-- CreateEnum
CREATE TYPE "ExamType" AS ENUM ('REGULAR', 'REAPPEAR', 'SUPPLEMENTARY', 'MAKE_UP');

-- CreateEnum
CREATE TYPE "ExamRegistrationStatus" AS ENUM ('REGISTERED', 'SEATED', 'RESULT_DECLARED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CourseOutcome" AS ENUM ('PENDING', 'P', 'F', 'NE', 'W', 'I', 'X');

-- CreateTable
CREATE TABLE "ExamRegistration" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "academicTermId" TEXT NOT NULL,
    "sourceCourseRegistrationId" TEXT,
    "examType" "ExamType" NOT NULL,
    "attemptNumber" INTEGER NOT NULL DEFAULT 1,
    "status" "ExamRegistrationStatus" NOT NULL DEFAULT 'REGISTERED',
    "eligibleAtRegistration" BOOLEAN NOT NULL,
    "eligibilitySnapshot" JSONB,
    "seeMarks" DOUBLE PRECISION,
    "maxSeeMarks" DOUBLE PRECISION,
    "outcome" "CourseOutcome" NOT NULL DEFAULT 'PENDING',
    "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExamRegistration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentPromotion" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "fromSemesterNumber" INTEGER NOT NULL,
    "toSemesterNumber" INTEGER NOT NULL,
    "fromSemesterId" TEXT,
    "toSemesterId" TEXT,
    "academicTermId" TEXT NOT NULL,
    "promotedById" TEXT NOT NULL,
    "promotedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "StudentPromotion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplementaryCourseOffering" (
    "id" TEXT NOT NULL,
    "academicTermId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,

    CONSTRAINT "SupplementaryCourseOffering_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcademicPolicyConfig" (
    "id" TEXT NOT NULL,
    "programType" "ProgramType",
    "admissionYear" TEXT,
    "maxTotalCredits" INTEGER NOT NULL DEFAULT 30,
    "maxSupplementaryCredits" INTEGER NOT NULL DEFAULT 16,
    "maxAttemptsBeforeAlternate" INTEGER NOT NULL DEFAULT 4,
    "maxAttemptsTotal" INTEGER NOT NULL DEFAULT 5,

    CONSTRAINT "AcademicPolicyConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExamRegistration_studentId_academicTermId_idx" ON "ExamRegistration"("studentId", "academicTermId");

-- CreateIndex
CREATE INDEX "ExamRegistration_courseId_idx" ON "ExamRegistration"("courseId");

-- CreateIndex
CREATE UNIQUE INDEX "ExamRegistration_studentId_courseId_academicTermId_examType_key" ON "ExamRegistration"("studentId", "courseId", "academicTermId", "examType");

-- CreateIndex
CREATE INDEX "StudentPromotion_studentId_idx" ON "StudentPromotion"("studentId");

-- CreateIndex
CREATE INDEX "StudentPromotion_academicTermId_idx" ON "StudentPromotion"("academicTermId");

-- CreateIndex
CREATE UNIQUE INDEX "SupplementaryCourseOffering_academicTermId_courseId_key" ON "SupplementaryCourseOffering"("academicTermId", "courseId");

-- CreateIndex
CREATE UNIQUE INDEX "AcademicPolicyConfig_programType_admissionYear_key" ON "AcademicPolicyConfig"("programType", "admissionYear");

-- AddForeignKey
ALTER TABLE "ExamRegistration" ADD CONSTRAINT "ExamRegistration_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamRegistration" ADD CONSTRAINT "ExamRegistration_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamRegistration" ADD CONSTRAINT "ExamRegistration_academicTermId_fkey" FOREIGN KEY ("academicTermId") REFERENCES "AcademicTerm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamRegistration" ADD CONSTRAINT "ExamRegistration_sourceCourseRegistrationId_fkey" FOREIGN KEY ("sourceCourseRegistrationId") REFERENCES "CourseRegistration"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentPromotion" ADD CONSTRAINT "StudentPromotion_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentPromotion" ADD CONSTRAINT "StudentPromotion_academicTermId_fkey" FOREIGN KEY ("academicTermId") REFERENCES "AcademicTerm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentPromotion" ADD CONSTRAINT "StudentPromotion_promotedById_fkey" FOREIGN KEY ("promotedById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentPromotion" ADD CONSTRAINT "StudentPromotion_fromSemesterId_fkey" FOREIGN KEY ("fromSemesterId") REFERENCES "Semester"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentPromotion" ADD CONSTRAINT "StudentPromotion_toSemesterId_fkey" FOREIGN KEY ("toSemesterId") REFERENCES "Semester"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplementaryCourseOffering" ADD CONSTRAINT "SupplementaryCourseOffering_academicTermId_fkey" FOREIGN KEY ("academicTermId") REFERENCES "AcademicTerm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplementaryCourseOffering" ADD CONSTRAINT "SupplementaryCourseOffering_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
