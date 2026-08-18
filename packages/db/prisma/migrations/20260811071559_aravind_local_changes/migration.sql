-- AlterEnum
ALTER TYPE "MessageChannel" ADD VALUE 'SMS';

-- DropForeignKey
ALTER TABLE "MessageCampaignReceipt" DROP CONSTRAINT "MessageCampaignReceipt_templateId_fkey";

-- AlterTable
ALTER TABLE "MessageCampaignReceipt" ALTER COLUMN "templateId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "MessageTemplate" ADD COLUMN     "smsTemplateId" TEXT;

-- AddForeignKey
ALTER TABLE "MessageCampaignReceipt" ADD CONSTRAINT "MessageCampaignReceipt_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "MessageTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "AdmissionConstants_modeOfAdmission_quota_categoryClaimed_c_key" RENAME TO "AdmissionConstants_modeOfAdmission_quota_categoryClaimed_ca_key";
