-- Supplementary offerings gain an ownership link to their dedicated teaching
-- section (nullable; section survives offering removal via SET NULL).
ALTER TABLE "Section" ADD COLUMN "supplementaryOfferingId" TEXT;
CREATE INDEX "Section_supplementaryOfferingId_idx" ON "Section"("supplementaryOfferingId");
ALTER TABLE "Section" ADD CONSTRAINT "Section_supplementaryOfferingId_fkey" FOREIGN KEY ("supplementaryOfferingId") REFERENCES "SupplementaryCourseOffering"("id") ON DELETE SET NULL ON UPDATE CASCADE;
