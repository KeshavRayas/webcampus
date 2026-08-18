-- CreateEnum
CREATE TYPE "AssessmentComponentType" AS ENUM ('THEORY', 'LAB', 'AAT');

-- CreateEnum
CREATE TYPE "CieEligibilityPolicy" AS ENUM ('OVERALL_ONLY', 'COMPONENT_AND_OVERALL');

-- CreateEnum
CREATE TYPE "SupportTicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "SupportTicketPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "SupportTicketCategory" AS ENUM ('ACADEMICS', 'ATTENDANCE', 'MARKS', 'ADMISSIONS', 'FINANCE', 'TECHNICAL', 'OTHER');

-- CreateEnum
CREATE TYPE "MessageCategory" AS ENUM ('CIE', 'BALANCE_FEE', 'ANNUAL_FEE', 'PARENT_TEACHER_MEETING');

-- CreateEnum
CREATE TYPE "MessageRecipientType" AS ENUM ('STUDENT', 'PARENT');

-- CreateEnum
CREATE TYPE "MessageScope" AS ENUM ('STUDENT', 'PARENT', 'BOTH');

-- CreateEnum
CREATE TYPE "MessageChannel" AS ENUM ('WHATSAPP');

-- CreateEnum
CREATE TYPE "MessageFieldSource" AS ENUM ('STUDENT_NAME', 'USN', 'DEPARTMENT', 'SECTION', 'SEMESTER', 'ACADEMIC_YEAR', 'SUBJECT_CODE', 'SUBJECT_NAME', 'CIE_MARKS', 'CIE_MAX', 'FEE_DEMAND', 'AMOUNT_PAID', 'BALANCE', 'FEE_AMOUNT', 'DEADLINE', 'PTM_DATE', 'PTM_TIME', 'PTM_VENUE');

-- CreateEnum
CREATE TYPE "ReceiptStatus" AS ENUM ('SUCCESS', 'FAILURE', 'SKIPPED');

-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'UPDATE_STUDENT_PROFILE';

-- AlterEnum
ALTER TYPE "AuditEntityType" ADD VALUE 'STUDENT_PROFILE';

-- DropForeignKey
ALTER TABLE "ClassSession" DROP CONSTRAINT "ClassSession_sectionId_fkey";

-- DropIndex
DROP INDEX "Admission_filledById_idx";

-- DropIndex
DROP INDEX "Attendance_studentId_courseId_batchId_key";

-- DropIndex
DROP INDEX "ClassSession_courseId_sectionId_sessionDate_timingCode_batc_key";

-- AlterTable
ALTER TABLE "AdminEditLog" ALTER COLUMN "changeGroupId" SET NOT NULL,
ALTER COLUMN "action" SET NOT NULL;

-- AlterTable
ALTER TABLE "Admission" DROP COLUMN "chemistryMinMarks",
DROP COLUMN "firstName",
DROP COLUMN "hostelRoomNumber",
DROP COLUMN "lastName",
DROP COLUMN "mathematicsMinMarks",
DROP COLUMN "middleName",
DROP COLUMN "physicsMinMarks",
ADD COLUMN     "diplomaCountry" TEXT,
ADD COLUMN     "instituteCountry" TEXT,
ADD COLUMN     "schoolCountry" TEXT,
ALTER COLUMN "modeOfAdmission" DROP NOT NULL,
ALTER COLUMN "applicationId" DROP NOT NULL,
ALTER COLUMN "primaryEmail" SET NOT NULL,
DROP COLUMN "categoryAllotted",
ADD COLUMN     "categoryAllotted" TEXT,
DROP COLUMN "categoryClaimed",
ADD COLUMN     "categoryClaimed" TEXT,
DROP COLUMN "quota",
ADD COLUMN     "quota" TEXT;

-- AlterTable
ALTER TABLE "AssessmentTemplate" ADD COLUMN     "componentType" "AssessmentComponentType" NOT NULL,
ADD COLUMN     "sequence" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "Course" DROP COLUMN "assignmentMaxMarks",
DROP COLUMN "cieMinMarks",
DROP COLUMN "cieWeightage",
DROP COLUMN "cumulativeMaxMarks",
DROP COLUMN "cumulativeMinMarks",
DROP COLUMN "labMinMarks",
DROP COLUMN "labWeightage",
DROP COLUMN "maxNoOfCies",
DROP COLUMN "minNoOfCies",
DROP COLUMN "noOfAssignments",
DROP COLUMN "seeMinMarks",
DROP COLUMN "seeWeightage",
ADD COLUMN     "aatEligibility" INTEGER NOT NULL DEFAULT 40,
ADD COLUMN     "aatMaxMarks" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "allowFeedback" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "attendanceRequired" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "cieEligibility" INTEGER NOT NULL DEFAULT 40,
ADD COLUMN     "cieEligibilityPolicy" "CieEligibilityPolicy" NOT NULL DEFAULT 'COMPONENT_AND_OVERALL',
ADD COLUMN     "labEligibility" INTEGER NOT NULL DEFAULT 40,
ADD COLUMN     "seeEligibility" INTEGER NOT NULL DEFAULT 40,
ADD COLUMN     "theoryCieContribution" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "theoryEligibility" INTEGER NOT NULL DEFAULT 40,
ADD COLUMN     "theoryExamMaxMarks" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "theoryMaxExams" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "theoryMinExams" INTEGER NOT NULL DEFAULT 0;

-- DropEnum
DROP TYPE "Category";

-- DropEnum
DROP TYPE "Quota";

-- CreateTable
CREATE TABLE "FeedbackQuestionSet" (
    "id" TEXT NOT NULL,
    "academicTermId" TEXT NOT NULL,
    "semesterId" TEXT NOT NULL,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "presetId" TEXT,

    CONSTRAINT "FeedbackQuestionSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeedbackQuestionPreset" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "academicTermId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeedbackQuestionPreset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeedbackQuestionPresetItem" (
    "id" TEXT NOT NULL,
    "presetId" TEXT NOT NULL,
    "questionNumber" INTEGER NOT NULL,
    "questionText" TEXT NOT NULL,

    CONSTRAINT "FeedbackQuestionPresetItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeedbackQuestion" (
    "id" TEXT NOT NULL,
    "questionSetId" TEXT NOT NULL,
    "questionNumber" INTEGER NOT NULL,
    "questionText" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeedbackQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeedbackRound" (
    "id" TEXT NOT NULL,
    "academicTermId" TEXT NOT NULL,
    "semesterId" TEXT NOT NULL,
    "questionSetId" TEXT NOT NULL,
    "roundNumber" INTEGER NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeedbackRound_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeedbackResponse" (
    "id" TEXT NOT NULL,
    "feedbackRoundId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "courseAssignmentId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "facultyId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "batchId" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeedbackResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeedbackAnswer" (
    "id" TEXT NOT NULL,
    "responseId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,

    CONSTRAINT "FeedbackAnswer_pkey" PRIMARY KEY ("id")
);

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

-- CreateTable
CREATE TABLE "SupportTicket" (
    "id" TEXT NOT NULL,
    "ticketNumber" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "category" "SupportTicketCategory" NOT NULL,
    "priority" "SupportTicketPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "SupportTicketStatus" NOT NULL DEFAULT 'OPEN',
    "subject" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "SupportTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportTicketMessage" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportTicketMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportTicketAttachment" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportTicketAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "MessageCategory" NOT NULL,
    "recipientType" "MessageRecipientType" NOT NULL,
    "externalTemplateId" TEXT NOT NULL,
    "messageBody" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MessageTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageTemplateVariable" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "fieldSource" "MessageFieldSource" NOT NULL,

    CONSTRAINT "MessageTemplateVariable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageCampaign" (
    "id" TEXT NOT NULL,
    "channel" "MessageChannel" NOT NULL DEFAULT 'WHATSAPP',
    "category" "MessageCategory" NOT NULL,
    "scope" "MessageScope" NOT NULL,
    "filterSnapshot" JSONB NOT NULL,
    "cieNumber" INTEGER,
    "subjectIds" JSONB,
    "adHocData" JSONB,
    "studentTemplateId" TEXT,
    "parentTemplateId" TEXT,
    "sentById" TEXT NOT NULL,
    "totalReceivers" INTEGER NOT NULL,
    "successCount" INTEGER NOT NULL,
    "failureCount" INTEGER NOT NULL,
    "skippedCount" INTEGER NOT NULL,
    "providerResponse" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageCampaignReceipt" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "courseId" TEXT,
    "recipientType" "MessageRecipientType" NOT NULL,
    "to" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "bodyvar" JSONB NOT NULL,
    "status" "ReceiptStatus" NOT NULL,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageCampaignReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FeedbackQuestionSet_semesterId_key" ON "FeedbackQuestionSet"("semesterId");

-- CreateIndex
CREATE INDEX "FeedbackQuestionSet_academicTermId_idx" ON "FeedbackQuestionSet"("academicTermId");

-- CreateIndex
CREATE UNIQUE INDEX "FeedbackQuestionSet_academicTermId_semesterId_key" ON "FeedbackQuestionSet"("academicTermId", "semesterId");

-- CreateIndex
CREATE UNIQUE INDEX "FeedbackQuestionPreset_name_key" ON "FeedbackQuestionPreset"("name");

-- CreateIndex
CREATE UNIQUE INDEX "FeedbackQuestionPresetItem_presetId_questionNumber_key" ON "FeedbackQuestionPresetItem"("presetId", "questionNumber");

-- CreateIndex
CREATE INDEX "FeedbackQuestion_questionSetId_idx" ON "FeedbackQuestion"("questionSetId");

-- CreateIndex
CREATE UNIQUE INDEX "FeedbackQuestion_questionSetId_questionNumber_key" ON "FeedbackQuestion"("questionSetId", "questionNumber");

-- CreateIndex
CREATE INDEX "FeedbackRound_semesterId_startsAt_endsAt_idx" ON "FeedbackRound"("semesterId", "startsAt", "endsAt");

-- CreateIndex
CREATE UNIQUE INDEX "FeedbackRound_academicTermId_semesterId_roundNumber_key" ON "FeedbackRound"("academicTermId", "semesterId", "roundNumber");

-- CreateIndex
CREATE INDEX "FeedbackResponse_feedbackRoundId_courseAssignmentId_idx" ON "FeedbackResponse"("feedbackRoundId", "courseAssignmentId");

-- CreateIndex
CREATE INDEX "FeedbackResponse_facultyId_feedbackRoundId_idx" ON "FeedbackResponse"("facultyId", "feedbackRoundId");

-- CreateIndex
CREATE INDEX "FeedbackResponse_courseId_sectionId_feedbackRoundId_idx" ON "FeedbackResponse"("courseId", "sectionId", "feedbackRoundId");

-- CreateIndex
CREATE UNIQUE INDEX "FeedbackResponse_studentId_feedbackRoundId_courseAssignment_key" ON "FeedbackResponse"("studentId", "feedbackRoundId", "courseAssignmentId");

-- CreateIndex
CREATE INDEX "FeedbackAnswer_questionId_idx" ON "FeedbackAnswer"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "FeedbackAnswer_responseId_questionId_key" ON "FeedbackAnswer"("responseId", "questionId");

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

-- CreateIndex
CREATE UNIQUE INDEX "SupportTicket_ticketNumber_key" ON "SupportTicket"("ticketNumber");

-- CreateIndex
CREATE INDEX "SupportTicket_createdById_idx" ON "SupportTicket"("createdById");

-- CreateIndex
CREATE INDEX "SupportTicket_status_idx" ON "SupportTicket"("status");

-- CreateIndex
CREATE INDEX "SupportTicket_createdAt_idx" ON "SupportTicket"("createdAt");

-- CreateIndex
CREATE INDEX "SupportTicketMessage_ticketId_createdAt_idx" ON "SupportTicketMessage"("ticketId", "createdAt");

-- CreateIndex
CREATE INDEX "SupportTicketMessage_authorId_idx" ON "SupportTicketMessage"("authorId");

-- CreateIndex
CREATE UNIQUE INDEX "SupportTicketAttachment_storageKey_key" ON "SupportTicketAttachment"("storageKey");

-- CreateIndex
CREATE INDEX "SupportTicketAttachment_messageId_idx" ON "SupportTicketAttachment"("messageId");

-- CreateIndex
CREATE INDEX "MessageTemplate_category_recipientType_idx" ON "MessageTemplate"("category", "recipientType");

-- CreateIndex
CREATE INDEX "MessageTemplate_isActive_idx" ON "MessageTemplate"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "MessageTemplateVariable_templateId_position_key" ON "MessageTemplateVariable"("templateId", "position");

-- CreateIndex
CREATE INDEX "MessageCampaign_category_idx" ON "MessageCampaign"("category");

-- CreateIndex
CREATE INDEX "MessageCampaign_createdAt_idx" ON "MessageCampaign"("createdAt");

-- CreateIndex
CREATE INDEX "MessageCampaignReceipt_campaignId_idx" ON "MessageCampaignReceipt"("campaignId");

-- CreateIndex
CREATE INDEX "MessageCampaignReceipt_status_idx" ON "MessageCampaignReceipt"("status");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentTemplate_courseId_componentType_sequence_key" ON "AssessmentTemplate"("courseId", "componentType", "sequence");

-- AddForeignKey
ALTER TABLE "FeedbackQuestionSet" ADD CONSTRAINT "FeedbackQuestionSet_academicTermId_fkey" FOREIGN KEY ("academicTermId") REFERENCES "AcademicTerm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedbackQuestionSet" ADD CONSTRAINT "FeedbackQuestionSet_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "Semester"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedbackQuestionSet" ADD CONSTRAINT "FeedbackQuestionSet_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedbackQuestionSet" ADD CONSTRAINT "FeedbackQuestionSet_presetId_fkey" FOREIGN KEY ("presetId") REFERENCES "FeedbackQuestionPreset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedbackQuestionPreset" ADD CONSTRAINT "FeedbackQuestionPreset_academicTermId_fkey" FOREIGN KEY ("academicTermId") REFERENCES "AcademicTerm"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedbackQuestionPreset" ADD CONSTRAINT "FeedbackQuestionPreset_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedbackQuestionPresetItem" ADD CONSTRAINT "FeedbackQuestionPresetItem_presetId_fkey" FOREIGN KEY ("presetId") REFERENCES "FeedbackQuestionPreset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedbackQuestion" ADD CONSTRAINT "FeedbackQuestion_questionSetId_fkey" FOREIGN KEY ("questionSetId") REFERENCES "FeedbackQuestionSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedbackRound" ADD CONSTRAINT "FeedbackRound_academicTermId_fkey" FOREIGN KEY ("academicTermId") REFERENCES "AcademicTerm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedbackRound" ADD CONSTRAINT "FeedbackRound_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "Semester"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedbackRound" ADD CONSTRAINT "FeedbackRound_questionSetId_fkey" FOREIGN KEY ("questionSetId") REFERENCES "FeedbackQuestionSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedbackRound" ADD CONSTRAINT "FeedbackRound_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedbackResponse" ADD CONSTRAINT "FeedbackResponse_feedbackRoundId_fkey" FOREIGN KEY ("feedbackRoundId") REFERENCES "FeedbackRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedbackResponse" ADD CONSTRAINT "FeedbackResponse_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedbackResponse" ADD CONSTRAINT "FeedbackResponse_courseAssignmentId_fkey" FOREIGN KEY ("courseAssignmentId") REFERENCES "CourseAssignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedbackResponse" ADD CONSTRAINT "FeedbackResponse_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedbackResponse" ADD CONSTRAINT "FeedbackResponse_facultyId_fkey" FOREIGN KEY ("facultyId") REFERENCES "Faculty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedbackAnswer" ADD CONSTRAINT "FeedbackAnswer_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "FeedbackResponse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedbackAnswer" ADD CONSTRAINT "FeedbackAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "FeedbackQuestion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassSession" ADD CONSTRAINT "ClassSession_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicketMessage" ADD CONSTRAINT "SupportTicketMessage_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicketMessage" ADD CONSTRAINT "SupportTicketMessage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicketAttachment" ADD CONSTRAINT "SupportTicketAttachment_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "SupportTicketMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageTemplateVariable" ADD CONSTRAINT "MessageTemplateVariable_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "MessageTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageCampaign" ADD CONSTRAINT "MessageCampaign_studentTemplateId_fkey" FOREIGN KEY ("studentTemplateId") REFERENCES "MessageTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageCampaign" ADD CONSTRAINT "MessageCampaign_parentTemplateId_fkey" FOREIGN KEY ("parentTemplateId") REFERENCES "MessageTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageCampaignReceipt" ADD CONSTRAINT "MessageCampaignReceipt_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "MessageCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageCampaignReceipt" ADD CONSTRAINT "MessageCampaignReceipt_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "MessageTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "ArchivedElectiveBatchFaculty_originalId_semesterId_archivedAt_k" RENAME TO "ArchivedElectiveBatchFaculty_originalId_semesterId_archived_key";

-- RenameIndex
ALTER INDEX "ClassSession_courseId_sectionId_sessionDate_timingCode_batchId_" RENAME TO "ClassSession_courseId_sectionId_sessionDate_timingCode_batc_key";

