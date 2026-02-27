/*
  Warnings:

  - You are about to drop the `_Coe` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `semesterId` to the `Course` table without a default value. This is not possible if the table is not empty.
  - Added the required column `semesterNumber` to the `Course` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "public"."_Coe" DROP CONSTRAINT "Coe_userId_fkey";

-- AlterTable
ALTER TABLE "public"."Course" ADD COLUMN     "semesterId" TEXT NOT NULL,
ADD COLUMN     "semesterNumber" INTEGER NOT NULL;

-- DropTable
DROP TABLE "public"."_Coe";

-- CreateTable
CREATE TABLE "public"."Coe" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "Coe_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Coe_userId_key" ON "public"."Coe"("userId");

-- AddForeignKey
ALTER TABLE "public"."Course" ADD CONSTRAINT "Course_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "public"."Semester"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Coe" ADD CONSTRAINT "Coe_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
