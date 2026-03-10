-- CreateTable
CREATE TABLE "public"."Admission" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phoneNumber" TEXT,
    "address" TEXT,
    "gender" TEXT,
    "fatherName" TEXT,
    "motherName" TEXT,
    "fatherEmail" TEXT,
    "motherEmail" TEXT,
    "fatherNumber" TEXT,
    "motherNumber" TEXT,
    "class10thMarks" DOUBLE PRECISION,
    "class12thMarks" DOUBLE PRECISION,
    "class10thMarksPdf" TEXT,
    "class12thMarksPdf" TEXT,
    "class10thSchoolName" TEXT,
    "class12thSchoolName" TEXT,
    "modeOfAdmission" TEXT,
    "photo" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Admission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Admission_email_key" ON "public"."Admission"("email");
