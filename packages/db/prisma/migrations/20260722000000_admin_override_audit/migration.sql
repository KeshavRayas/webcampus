-- CreateEnum
CREATE TYPE "AuditEntityType" AS ENUM ('COURSE', 'COURSE_ASSIGNMENT', 'COORDINATOR', 'BATCH', 'ASSESSMENT');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('SUPER_EDIT', 'UPSERT_MAPPING', 'DELETE_MAPPING', 'UPDATE_COORDINATOR');

-- AlterTable: Course - add optimistic locking and override tracking
ALTER TABLE "Course"
ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "lastOverrideAt" TIMESTAMP(3),
ADD COLUMN "lastOverrideById" TEXT,
ADD COLUMN "overrideCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "hasPostApprovalEdits" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable: AdminEditLog (pre-ALTER base columns)
CREATE TABLE "AdminEditLog" (
    "id" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "entityType" "AuditEntityType" NOT NULL,
    "details" TEXT,
    "adminUserId" TEXT NOT NULL,
    "editedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminEditLog_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "AdminEditLog" ADD CONSTRAINT "AdminEditLog_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable: AdminEditLog - add structured audit columns (backward-compatible)
ALTER TABLE "AdminEditLog"
ADD COLUMN "changeGroupId" TEXT,
ADD COLUMN "courseId" TEXT,
ADD COLUMN "fieldName" TEXT,
ADD COLUMN "oldValue" JSONB,
ADD COLUMN "newValue" JSONB,
ADD COLUMN "action" "AuditAction",
ADD COLUMN "reason" TEXT,
ADD COLUMN "ipAddress" TEXT,
ADD COLUMN "userAgent" TEXT;

-- CreateIndex
CREATE INDEX "AdminEditLog_entityType_entityId_idx" ON "AdminEditLog"("entityType", "entityId");
CREATE INDEX "AdminEditLog_changeGroupId_idx" ON "AdminEditLog"("changeGroupId");
CREATE INDEX "AdminEditLog_courseId_idx" ON "AdminEditLog"("courseId");
CREATE INDEX "AdminEditLog_editedAt_idx" ON "AdminEditLog"("editedAt");
CREATE INDEX "AdminEditLog_adminUserId_idx" ON "AdminEditLog"("adminUserId");
