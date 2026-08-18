-- AlterTable
ALTER TABLE "Freeze" ADD COLUMN     "electiveBatchFacultyId" TEXT,
ALTER COLUMN "courseAssignmentId" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Freeze_electiveBatchFacultyId_key" ON "Freeze"("electiveBatchFacultyId");

-- AddForeignKey
ALTER TABLE "Freeze" ADD CONSTRAINT "Freeze_electiveBatchFacultyId_fkey" FOREIGN KEY ("electiveBatchFacultyId") REFERENCES "ElectiveBatchFaculty"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Exactly one ownership path: a Freeze row belongs to a CourseAssignment (PC/NCMC)
-- XOR an ElectiveBatchFaculty (PE/OE).
ALTER TABLE "Freeze" ADD CONSTRAINT "Freeze_ownership_exactly_one" CHECK ( ((("courseAssignmentId" IS NOT NULL))::int + (("electiveBatchFacultyId" IS NOT NULL))::int) = 1 );
