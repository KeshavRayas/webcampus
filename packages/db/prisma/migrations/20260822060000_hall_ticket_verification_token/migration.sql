-- Align live DB with schema.prisma: HallTicket.verificationToken existed only
-- in the schema (pre-existing audit-noted drift) and is required by hall-ticket
-- verification flows.
ALTER TABLE "HallTicket" ADD COLUMN "verificationToken" TEXT;
CREATE UNIQUE INDEX "HallTicket_verificationToken_key" ON "HallTicket"("verificationToken");
CREATE INDEX "HallTicket_verificationToken_idx" ON "HallTicket"("verificationToken");
