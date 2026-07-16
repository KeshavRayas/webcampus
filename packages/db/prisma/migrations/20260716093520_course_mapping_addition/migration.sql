-- DropForeignKey
ALTER TABLE "Freeze" DROP CONSTRAINT "Freeze_courseAssignmentId_fkey";

-- AlterTable
ALTER TABLE "Admission" ADD COLUMN     "diplomaAggregateScore" DOUBLE PRECISION,
ADD COLUMN     "diplomaAggregateTotal" DOUBLE PRECISION,
ADD COLUMN     "diplomaBranch" TEXT,
ADD COLUMN     "diplomaInstituteCity" TEXT,
ADD COLUMN     "diplomaInstituteCode" TEXT,
ADD COLUMN     "diplomaInstituteName" TEXT,
ADD COLUMN     "diplomaInstituteState" TEXT,
ADD COLUMN     "diplomaInstituteType" TEXT,
ADD COLUMN     "diplomaMarksPdf" TEXT,
ADD COLUMN     "diplomaMediumOfTeaching" TEXT,
ADD COLUMN     "diplomaYearOfPassing" TEXT,
ADD COLUMN     "hasClass12" BOOLEAN,
ADD COLUMN     "hasDiploma" BOOLEAN;

-- CreateTable
CREATE TABLE "CourseMappingAuditLog" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourseMappingAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CourseMappingAuditLog_courseId_idx" ON "CourseMappingAuditLog"("courseId");

-- CreateIndex
CREATE INDEX "CourseMappingAuditLog_adminId_idx" ON "CourseMappingAuditLog"("adminId");

-- AddForeignKey
ALTER TABLE "Freeze" ADD CONSTRAINT "Freeze_courseAssignmentId_fkey" FOREIGN KEY ("courseAssignmentId") REFERENCES "CourseAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseMappingAuditLog" ADD CONSTRAINT "CourseMappingAuditLog_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseMappingAuditLog" ADD CONSTRAINT "CourseMappingAuditLog_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
