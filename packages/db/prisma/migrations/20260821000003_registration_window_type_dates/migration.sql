-- DropIndex
DROP INDEX "RegistrationWindow_academicTermId_semesterId_departmentId_c_key";

-- AlterTable
ALTER TABLE "RegistrationWindow" ADD COLUMN     "endsAt" TIMESTAMP(3),
ADD COLUMN     "registrationType" "RegistrationType" NOT NULL DEFAULT 'REGULAR',
ADD COLUMN     "startsAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "RegistrationWindow_academicTermId_semesterId_departmentId_c_key" ON "RegistrationWindow"("academicTermId", "semesterId", "departmentId", "cycle", "registrationType");
