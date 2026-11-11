-- DropIndex
DROP INDEX "deal_finance_journal_versions_dealId_contentHash_key";

-- CreateIndex
CREATE INDEX "deal_finance_journal_versions_dealId_contentHash_idx" ON "deal_finance_journal_versions"("dealId", "contentHash");

-- CreateIndex
CREATE INDEX "deal_finance_journal_versions_dealId_asOfOn_idx" ON "deal_finance_journal_versions"("dealId", "asOfOn");
