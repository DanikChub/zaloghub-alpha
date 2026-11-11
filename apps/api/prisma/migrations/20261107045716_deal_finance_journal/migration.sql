-- CreateTable
CREATE TABLE "deal_finance_journal_versions" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "asOfOn" DATE NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "engineVersion" TEXT NOT NULL,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "contentHash" TEXT NOT NULL,
    "payload" JSONB NOT NULL,

    CONSTRAINT "deal_finance_journal_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "deal_finance_journal_versions_dealId_recordedAt_id_idx" ON "deal_finance_journal_versions"("dealId", "recordedAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "deal_finance_journal_versions_dealId_contentHash_key" ON "deal_finance_journal_versions"("dealId", "contentHash");

-- AddForeignKey
ALTER TABLE "deal_finance_journal_versions" ADD CONSTRAINT "deal_finance_journal_versions_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "deals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
