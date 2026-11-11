-- Additive migration: preserve existing terms and cash operations.
ALTER TABLE "deals" ADD COLUMN "financeTerms" JSONB;
ALTER TABLE "payments" ADD COLUMN "idempotencyKey" TEXT, ADD COLUMN "voidedAt" TIMESTAMP(3);
ALTER TABLE "disbursements" ADD COLUMN "idempotencyKey" TEXT, ADD COLUMN "voidedAt" TIMESTAMP(3);
CREATE UNIQUE INDEX "payments_dealId_idempotencyKey_key" ON "payments"("dealId", "idempotencyKey");
CREATE UNIQUE INDEX "disbursements_dealId_idempotencyKey_key" ON "disbursements"("dealId", "idempotencyKey");
