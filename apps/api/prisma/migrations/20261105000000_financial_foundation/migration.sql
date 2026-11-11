-- Additive financial foundation. Existing financial values are not converted.
BEGIN;

-- CreateEnum
CREATE TYPE "WorkspaceRole" AS ENUM ('OWNER', 'ADMIN', 'MANAGER', 'VIEWER');

-- CreateEnum
CREATE TYPE "PartyKind" AS ENUM ('PERSON', 'ENTREPRENEUR', 'COMPANY');

-- CreateEnum
CREATE TYPE "ContractKind" AS ENUM ('LOAN', 'PLEDGE', 'AGENCY', 'GUARANTEE', 'OTHER');

-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('DRAFT', 'ACTIVE', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ContractPartyRole" AS ENUM ('LENDER', 'BORROWER', 'PLEDGOR', 'GUARANTOR', 'AGENT', 'OTHER');

-- CreateEnum
CREATE TYPE "DocumentRole" AS ENUM ('MAIN', 'AMENDMENT', 'NOTICE', 'PAYMENT_INSTRUCTION', 'EXPENSE_EVIDENCE', 'OTHER');

-- CreateEnum
CREATE TYPE "LoanAccountStatus" AS ENUM ('DRAFT', 'ACTIVE', 'CLOSED');

-- CreateEnum
CREATE TYPE "PublicationStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "TermRuleKind" AS ENUM ('INTEREST', 'SCHEDULE', 'PENALTY', 'ALLOCATION', 'PREPAYMENT', 'RATE_TRANSITION');

-- CreateEnum
CREATE TYPE "FinancialEventKind" AS ENUM ('DISBURSEMENT', 'RECEIPT', 'REVERSAL', 'EXPENSE', 'WAIVER', 'NOTICE', 'SETTLEMENT');

-- CreateEnum
CREATE TYPE "CalculationStatus" AS ENUM ('RUNNING', 'SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "CalculationInputKind" AS ENUM ('EVENT', 'TERMS_VERSION', 'CALENDAR_VERSION');

-- CreateEnum
CREATE TYPE "DebtComponent" AS ENUM ('PRINCIPAL', 'INTEREST', 'PENALTY', 'EXPENSE');

-- CreateEnum
CREATE TYPE "RateUnit" AS ENUM ('DAY', 'MONTH', 'YEAR');

-- AlterTable
ALTER TABLE "borrowers" ADD COLUMN     "workspaceId" TEXT;

-- AlterTable
ALTER TABLE "collaterals" ADD COLUMN     "workspaceId" TEXT;

-- AlterTable
ALTER TABLE "deals" ADD COLUMN     "workspaceId" TEXT;

-- CreateTable
CREATE TABLE "workspaces" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "personal_owner_id" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "workspaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspace_members" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" "WorkspaceRole" NOT NULL DEFAULT 'VIEWER',

    CONSTRAINT "workspace_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parties" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "kind" "PartyKind" NOT NULL,
    "display_name" TEXT NOT NULL,
    "tax_id" TEXT,
    "user_id" TEXT,
    "legacy_borrower_id" TEXT,

    CONSTRAINT "parties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contracts" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "deal_id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "kind" "ContractKind" NOT NULL,
    "signed_on" DATE,
    "status" "ContractStatus" NOT NULL DEFAULT 'DRAFT',

    CONSTRAINT "contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_parties" (
    "id" TEXT NOT NULL,
    "contract_id" TEXT NOT NULL,
    "party_id" TEXT NOT NULL,
    "role" "ContractPartyRole" NOT NULL,
    "workspace_id" TEXT NOT NULL,

    CONSTRAINT "contract_parties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_documents" (
    "id" TEXT NOT NULL,
    "contract_id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "role" "DocumentRole" NOT NULL,
    "workspace_id" TEXT NOT NULL,

    CONSTRAINT "contract_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_collaterals" (
    "id" TEXT NOT NULL,
    "contract_id" TEXT NOT NULL,
    "collateral_id" TEXT NOT NULL,
    "secured_amount" DECIMAL(20,2),
    "currency" CHAR(3) NOT NULL,
    "priority" INTEGER NOT NULL,
    "workspace_id" TEXT NOT NULL,

    CONSTRAINT "contract_collaterals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loan_accounts" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "contract_id" TEXT NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "status" "LoanAccountStatus" NOT NULL DEFAULT 'DRAFT',

    CONSTRAINT "loan_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_versions" (
    "id" TEXT NOT NULL,
    "calendar_code" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "content_hash" TEXT NOT NULL,
    "status" "PublicationStatus" NOT NULL DEFAULT 'DRAFT',

    CONSTRAINT "calendar_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_days" (
    "id" TEXT NOT NULL,
    "calendar_version_id" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "is_working" BOOLEAN NOT NULL,

    CONSTRAINT "calendar_days_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "terms_versions" (
    "id" TEXT NOT NULL,
    "loan_account_id" TEXT NOT NULL,
    "version_no" INTEGER NOT NULL,
    "effective_on" DATE NOT NULL,
    "recorded_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "schema_version" TEXT NOT NULL,
    "contract_amount" DECIMAL(20,2) NOT NULL,
    "maturity_on" DATE,
    "calendar_version_id" TEXT NOT NULL,
    "day_count_policy" JSONB NOT NULL DEFAULT '{}',
    "rounding_policy" JSONB NOT NULL DEFAULT '{}',
    "source_document_id" TEXT,
    "source_clause" TEXT,
    "status" "PublicationStatus" NOT NULL DEFAULT 'DRAFT',
    "content_hash" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,

    CONSTRAINT "terms_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "term_rules" (
    "id" TEXT NOT NULL,
    "terms_version_id" TEXT NOT NULL,
    "rule_key" TEXT NOT NULL,
    "kind" "TermRuleKind" NOT NULL,
    "priority" INTEGER NOT NULL,
    "definition" JSONB NOT NULL DEFAULT '{}',
    "source_clause" TEXT NOT NULL,
    "loan_account_id" TEXT NOT NULL,

    CONSTRAINT "term_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_events" (
    "id" TEXT NOT NULL,
    "loan_account_id" TEXT NOT NULL,
    "kind" "FinancialEventKind" NOT NULL,
    "effective_on" DATE NOT NULL,
    "recorded_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sequence_no" BIGINT NOT NULL,
    "amount" DECIMAL(20,2),
    "counterparty_id" TEXT,
    "source_system" TEXT NOT NULL,
    "source_ref" TEXT NOT NULL,
    "source_revision" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "reverses_event_id" TEXT,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "workspace_id" TEXT NOT NULL,

    CONSTRAINT "financial_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calculation_runs" (
    "id" TEXT NOT NULL,
    "loan_account_id" TEXT NOT NULL,
    "as_of_on" DATE NOT NULL,
    "knowledge_cutoff" TIMESTAMPTZ(3) NOT NULL,
    "engine_version" TEXT NOT NULL,
    "input_hash" TEXT NOT NULL,
    "status" "CalculationStatus" NOT NULL DEFAULT 'RUNNING',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "supersedes_run_id" TEXT,

    CONSTRAINT "calculation_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calculation_inputs" (
    "id" TEXT NOT NULL,
    "run_id" TEXT NOT NULL,
    "input_kind" "CalculationInputKind" NOT NULL,
    "input_ref" TEXT NOT NULL,
    "content_hash" TEXT NOT NULL,
    "loan_account_id" TEXT NOT NULL,

    CONSTRAINT "calculation_inputs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "obligations" (
    "id" TEXT NOT NULL,
    "run_id" TEXT NOT NULL,
    "obligation_key" TEXT NOT NULL,
    "component" "DebtComponent" NOT NULL,
    "period_from" DATE,
    "period_to" DATE,
    "due_on" DATE NOT NULL,
    "amount" DECIMAL(20,2) NOT NULL,
    "unpaid_amount" DECIMAL(20,2) NOT NULL,
    "terms_version_id" TEXT NOT NULL,
    "loan_account_id" TEXT NOT NULL,

    CONSTRAINT "obligations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accrual_lines" (
    "id" TEXT NOT NULL,
    "run_id" TEXT NOT NULL,
    "obligation_id" TEXT,
    "rule_id" TEXT NOT NULL,
    "period_from" DATE NOT NULL,
    "period_to" DATE NOT NULL,
    "base_amount" DECIMAL(20,2) NOT NULL,
    "rate" DECIMAL(18,10) NOT NULL,
    "rate_unit" "RateUnit" NOT NULL,
    "day_count" INTEGER NOT NULL,
    "unrounded_amount" DECIMAL(30,12) NOT NULL,
    "rounded_amount" DECIMAL(20,2) NOT NULL,
    "explanation" JSONB NOT NULL DEFAULT '{}',
    "loan_account_id" TEXT NOT NULL,
    "terms_version_id" TEXT NOT NULL,

    CONSTRAINT "accrual_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_allocations" (
    "id" TEXT NOT NULL,
    "run_id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "obligation_id" TEXT NOT NULL,
    "amount" DECIMAL(20,2) NOT NULL,
    "order_no" INTEGER NOT NULL,
    "rule_id" TEXT NOT NULL,
    "loan_account_id" TEXT NOT NULL,
    "terms_version_id" TEXT NOT NULL,

    CONSTRAINT "payment_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loan_snapshots" (
    "id" TEXT NOT NULL,
    "run_id" TEXT NOT NULL,
    "principal_outstanding" DECIMAL(20,2) NOT NULL,
    "interest_unpaid" DECIMAL(20,2) NOT NULL,
    "penalty_unpaid" DECIMAL(20,2) NOT NULL,
    "expenses_unpaid" DECIMAL(20,2) NOT NULL,
    "unapplied_credit" DECIMAL(20,2) NOT NULL,
    "due_total" DECIMAL(20,2) NOT NULL,
    "overdue_total" DECIMAL(20,2) NOT NULL,
    "days_past_due" INTEGER NOT NULL,
    "next_payment_on" DATE,
    "next_payment_amount" DECIMAL(20,2),
    "payoff_amount" DECIMAL(20,2),
    "diagnostics" JSONB NOT NULL DEFAULT '{}',
    "loan_account_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "loan_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_entries" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "actor_id" TEXT,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "recorded_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "details" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "audit_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "workspaces_personal_owner_id_key" ON "workspaces"("personal_owner_id");

-- CreateIndex
CREATE INDEX "workspace_members_user_id_idx" ON "workspace_members"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_members_workspace_id_user_id_key" ON "workspace_members"("workspace_id", "user_id");

-- CreateIndex
CREATE INDEX "parties_user_id_idx" ON "parties"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "parties_id_workspace_id_key" ON "parties"("id", "workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "parties_workspace_id_user_id_key" ON "parties"("workspace_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "parties_legacy_borrower_id_key" ON "parties"("legacy_borrower_id");

-- CreateIndex
CREATE UNIQUE INDEX "parties_legacy_borrower_id_workspace_id_key" ON "parties"("legacy_borrower_id", "workspace_id");

-- CreateIndex
CREATE INDEX "contracts_workspace_id_idx" ON "contracts"("workspace_id");

-- CreateIndex
CREATE INDEX "contracts_deal_id_workspace_id_idx" ON "contracts"("deal_id", "workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "contracts_id_workspace_id_key" ON "contracts"("id", "workspace_id");

-- CreateIndex
CREATE INDEX "contract_parties_contract_id_workspace_id_idx" ON "contract_parties"("contract_id", "workspace_id");

-- CreateIndex
CREATE INDEX "contract_parties_party_id_workspace_id_idx" ON "contract_parties"("party_id", "workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "contract_parties_contract_id_party_id_role_key" ON "contract_parties"("contract_id", "party_id", "role");

-- CreateIndex
CREATE INDEX "documents_workspace_id_idx" ON "documents"("workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "documents_id_workspace_id_key" ON "documents"("id", "workspace_id");

-- CreateIndex
CREATE INDEX "contract_documents_contract_id_workspace_id_idx" ON "contract_documents"("contract_id", "workspace_id");

-- CreateIndex
CREATE INDEX "contract_documents_document_id_workspace_id_idx" ON "contract_documents"("document_id", "workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "contract_documents_contract_id_document_id_role_key" ON "contract_documents"("contract_id", "document_id", "role");

-- CreateIndex
CREATE INDEX "contract_collaterals_contract_id_workspace_id_idx" ON "contract_collaterals"("contract_id", "workspace_id");

-- CreateIndex
CREATE INDEX "contract_collaterals_collateral_id_workspace_id_idx" ON "contract_collaterals"("collateral_id", "workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "contract_collaterals_contract_id_collateral_id_key" ON "contract_collaterals"("contract_id", "collateral_id");

-- CreateIndex
CREATE UNIQUE INDEX "loan_accounts_contract_id_key" ON "loan_accounts"("contract_id");

-- CreateIndex
CREATE UNIQUE INDEX "loan_accounts_contract_id_workspace_id_key" ON "loan_accounts"("contract_id", "workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "loan_accounts_id_workspace_id_key" ON "loan_accounts"("id", "workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "calendar_versions_calendar_code_version_key" ON "calendar_versions"("calendar_code", "version");

-- CreateIndex
CREATE UNIQUE INDEX "calendar_days_calendar_version_id_day_key" ON "calendar_days"("calendar_version_id", "day");

-- CreateIndex
CREATE INDEX "terms_versions_loan_account_id_workspace_id_idx" ON "terms_versions"("loan_account_id", "workspace_id");

-- CreateIndex
CREATE INDEX "terms_versions_calendar_version_id_idx" ON "terms_versions"("calendar_version_id");

-- CreateIndex
CREATE INDEX "terms_versions_source_document_id_workspace_id_idx" ON "terms_versions"("source_document_id", "workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "terms_versions_loan_account_id_version_no_key" ON "terms_versions"("loan_account_id", "version_no");

-- CreateIndex
CREATE UNIQUE INDEX "terms_versions_id_loan_account_id_key" ON "terms_versions"("id", "loan_account_id");

-- CreateIndex
CREATE INDEX "term_rules_terms_version_id_loan_account_id_idx" ON "term_rules"("terms_version_id", "loan_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "term_rules_terms_version_id_rule_key_key" ON "term_rules"("terms_version_id", "rule_key");

-- CreateIndex
CREATE UNIQUE INDEX "term_rules_id_terms_version_id_loan_account_id_key" ON "term_rules"("id", "terms_version_id", "loan_account_id");

-- CreateIndex
CREATE INDEX "financial_events_loan_account_id_workspace_id_idx" ON "financial_events"("loan_account_id", "workspace_id");

-- CreateIndex
CREATE INDEX "financial_events_counterparty_id_workspace_id_idx" ON "financial_events"("counterparty_id", "workspace_id");

-- CreateIndex
CREATE INDEX "financial_events_loan_account_id_effective_on_sequence_no_idx" ON "financial_events"("loan_account_id", "effective_on", "sequence_no");

-- CreateIndex
CREATE UNIQUE INDEX "financial_events_loan_account_id_idempotency_key_key" ON "financial_events"("loan_account_id", "idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "financial_events_loan_account_id_sequence_no_key" ON "financial_events"("loan_account_id", "sequence_no");

-- CreateIndex
CREATE UNIQUE INDEX "financial_events_id_loan_account_id_key" ON "financial_events"("id", "loan_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "financial_events_reverses_event_id_key" ON "financial_events"("reverses_event_id");

-- CreateIndex
CREATE UNIQUE INDEX "financial_events_reverses_event_id_loan_account_id_key" ON "financial_events"("reverses_event_id", "loan_account_id");

-- CreateIndex
CREATE INDEX "calculation_runs_loan_account_id_idx" ON "calculation_runs"("loan_account_id");

-- CreateIndex
CREATE INDEX "calculation_runs_supersedes_run_id_loan_account_id_idx" ON "calculation_runs"("supersedes_run_id", "loan_account_id");

-- CreateIndex
CREATE INDEX "calculation_runs_loan_account_id_as_of_on_created_at_idx" ON "calculation_runs"("loan_account_id", "as_of_on", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "calculation_runs_id_loan_account_id_key" ON "calculation_runs"("id", "loan_account_id");

-- CreateIndex
CREATE INDEX "calculation_inputs_run_id_loan_account_id_idx" ON "calculation_inputs"("run_id", "loan_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "calculation_inputs_run_id_input_kind_input_ref_key" ON "calculation_inputs"("run_id", "input_kind", "input_ref");

-- CreateIndex
CREATE INDEX "obligations_run_id_loan_account_id_idx" ON "obligations"("run_id", "loan_account_id");

-- CreateIndex
CREATE INDEX "obligations_terms_version_id_loan_account_id_idx" ON "obligations"("terms_version_id", "loan_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "obligations_run_id_obligation_key_key" ON "obligations"("run_id", "obligation_key");

-- CreateIndex
CREATE UNIQUE INDEX "obligations_id_run_id_loan_account_id_terms_version_id_key" ON "obligations"("id", "run_id", "loan_account_id", "terms_version_id");

-- CreateIndex
CREATE INDEX "accrual_lines_run_id_loan_account_id_idx" ON "accrual_lines"("run_id", "loan_account_id");

-- CreateIndex
CREATE INDEX "accrual_lines_rule_id_terms_version_id_loan_account_id_idx" ON "accrual_lines"("rule_id", "terms_version_id", "loan_account_id");

-- CreateIndex
CREATE INDEX "accrual_lines_obligation_id_run_id_loan_account_id_terms_ve_idx" ON "accrual_lines"("obligation_id", "run_id", "loan_account_id", "terms_version_id");

-- CreateIndex
CREATE INDEX "payment_allocations_run_id_loan_account_id_idx" ON "payment_allocations"("run_id", "loan_account_id");

-- CreateIndex
CREATE INDEX "payment_allocations_rule_id_terms_version_id_loan_account_i_idx" ON "payment_allocations"("rule_id", "terms_version_id", "loan_account_id");

-- CreateIndex
CREATE INDEX "payment_allocations_obligation_id_run_id_loan_account_id_te_idx" ON "payment_allocations"("obligation_id", "run_id", "loan_account_id", "terms_version_id");

-- CreateIndex
CREATE INDEX "payment_allocations_event_id_loan_account_id_idx" ON "payment_allocations"("event_id", "loan_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_allocations_run_id_event_id_order_no_key" ON "payment_allocations"("run_id", "event_id", "order_no");

-- CreateIndex
CREATE UNIQUE INDEX "loan_snapshots_run_id_key" ON "loan_snapshots"("run_id");

-- CreateIndex
CREATE UNIQUE INDEX "loan_snapshots_run_id_loan_account_id_key" ON "loan_snapshots"("run_id", "loan_account_id");

-- CreateIndex
CREATE INDEX "audit_entries_workspace_id_idx" ON "audit_entries"("workspace_id");

-- CreateIndex
CREATE INDEX "audit_entries_actor_id_idx" ON "audit_entries"("actor_id");

-- CreateIndex
CREATE INDEX "audit_entries_workspace_id_recorded_at_idx" ON "audit_entries"("workspace_id", "recorded_at");

-- CreateIndex
CREATE INDEX "borrowers_workspaceId_idx" ON "borrowers"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "borrowers_id_workspaceId_key" ON "borrowers"("id", "workspaceId");

-- CreateIndex
CREATE INDEX "collaterals_workspaceId_idx" ON "collaterals"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "collaterals_id_workspaceId_key" ON "collaterals"("id", "workspaceId");

-- CreateIndex
CREATE INDEX "deals_workspaceId_idx" ON "deals"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "deals_id_workspaceId_key" ON "deals"("id", "workspaceId");

-- AddForeignKey
ALTER TABLE "borrowers" ADD CONSTRAINT "borrowers_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collaterals" ADD CONSTRAINT "collaterals_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_personal_owner_id_fkey" FOREIGN KEY ("personal_owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parties" ADD CONSTRAINT "parties_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parties" ADD CONSTRAINT "parties_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parties" ADD CONSTRAINT "parties_legacy_borrower_id_workspace_id_fkey" FOREIGN KEY ("legacy_borrower_id", "workspace_id") REFERENCES "borrowers"("id", "workspaceId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_deal_id_workspace_id_fkey" FOREIGN KEY ("deal_id", "workspace_id") REFERENCES "deals"("id", "workspaceId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_parties" ADD CONSTRAINT "contract_parties_contract_id_workspace_id_fkey" FOREIGN KEY ("contract_id", "workspace_id") REFERENCES "contracts"("id", "workspace_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_parties" ADD CONSTRAINT "contract_parties_party_id_workspace_id_fkey" FOREIGN KEY ("party_id", "workspace_id") REFERENCES "parties"("id", "workspace_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_documents" ADD CONSTRAINT "contract_documents_contract_id_workspace_id_fkey" FOREIGN KEY ("contract_id", "workspace_id") REFERENCES "contracts"("id", "workspace_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_documents" ADD CONSTRAINT "contract_documents_document_id_workspace_id_fkey" FOREIGN KEY ("document_id", "workspace_id") REFERENCES "documents"("id", "workspace_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_collaterals" ADD CONSTRAINT "contract_collaterals_contract_id_workspace_id_fkey" FOREIGN KEY ("contract_id", "workspace_id") REFERENCES "contracts"("id", "workspace_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_collaterals" ADD CONSTRAINT "contract_collaterals_collateral_id_workspace_id_fkey" FOREIGN KEY ("collateral_id", "workspace_id") REFERENCES "collaterals"("id", "workspaceId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_accounts" ADD CONSTRAINT "loan_accounts_contract_id_workspace_id_fkey" FOREIGN KEY ("contract_id", "workspace_id") REFERENCES "contracts"("id", "workspace_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_days" ADD CONSTRAINT "calendar_days_calendar_version_id_fkey" FOREIGN KEY ("calendar_version_id") REFERENCES "calendar_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "terms_versions" ADD CONSTRAINT "terms_versions_loan_account_id_workspace_id_fkey" FOREIGN KEY ("loan_account_id", "workspace_id") REFERENCES "loan_accounts"("id", "workspace_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "terms_versions" ADD CONSTRAINT "terms_versions_calendar_version_id_fkey" FOREIGN KEY ("calendar_version_id") REFERENCES "calendar_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "terms_versions" ADD CONSTRAINT "terms_versions_source_document_id_workspace_id_fkey" FOREIGN KEY ("source_document_id", "workspace_id") REFERENCES "documents"("id", "workspace_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "term_rules" ADD CONSTRAINT "term_rules_terms_version_id_loan_account_id_fkey" FOREIGN KEY ("terms_version_id", "loan_account_id") REFERENCES "terms_versions"("id", "loan_account_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_events" ADD CONSTRAINT "financial_events_loan_account_id_workspace_id_fkey" FOREIGN KEY ("loan_account_id", "workspace_id") REFERENCES "loan_accounts"("id", "workspace_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_events" ADD CONSTRAINT "financial_events_counterparty_id_workspace_id_fkey" FOREIGN KEY ("counterparty_id", "workspace_id") REFERENCES "parties"("id", "workspace_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_events" ADD CONSTRAINT "financial_events_reverses_event_id_loan_account_id_fkey" FOREIGN KEY ("reverses_event_id", "loan_account_id") REFERENCES "financial_events"("id", "loan_account_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calculation_runs" ADD CONSTRAINT "calculation_runs_loan_account_id_fkey" FOREIGN KEY ("loan_account_id") REFERENCES "loan_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calculation_runs" ADD CONSTRAINT "calculation_runs_supersedes_run_id_loan_account_id_fkey" FOREIGN KEY ("supersedes_run_id", "loan_account_id") REFERENCES "calculation_runs"("id", "loan_account_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calculation_inputs" ADD CONSTRAINT "calculation_inputs_run_id_loan_account_id_fkey" FOREIGN KEY ("run_id", "loan_account_id") REFERENCES "calculation_runs"("id", "loan_account_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "obligations" ADD CONSTRAINT "obligations_run_id_loan_account_id_fkey" FOREIGN KEY ("run_id", "loan_account_id") REFERENCES "calculation_runs"("id", "loan_account_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "obligations" ADD CONSTRAINT "obligations_terms_version_id_loan_account_id_fkey" FOREIGN KEY ("terms_version_id", "loan_account_id") REFERENCES "terms_versions"("id", "loan_account_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accrual_lines" ADD CONSTRAINT "accrual_lines_run_id_loan_account_id_fkey" FOREIGN KEY ("run_id", "loan_account_id") REFERENCES "calculation_runs"("id", "loan_account_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accrual_lines" ADD CONSTRAINT "accrual_lines_rule_id_terms_version_id_loan_account_id_fkey" FOREIGN KEY ("rule_id", "terms_version_id", "loan_account_id") REFERENCES "term_rules"("id", "terms_version_id", "loan_account_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accrual_lines" ADD CONSTRAINT "accrual_lines_obligation_id_run_id_loan_account_id_terms_v_fkey" FOREIGN KEY ("obligation_id", "run_id", "loan_account_id", "terms_version_id") REFERENCES "obligations"("id", "run_id", "loan_account_id", "terms_version_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_run_id_loan_account_id_fkey" FOREIGN KEY ("run_id", "loan_account_id") REFERENCES "calculation_runs"("id", "loan_account_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_rule_id_terms_version_id_loan_account__fkey" FOREIGN KEY ("rule_id", "terms_version_id", "loan_account_id") REFERENCES "term_rules"("id", "terms_version_id", "loan_account_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_obligation_id_run_id_loan_account_id_t_fkey" FOREIGN KEY ("obligation_id", "run_id", "loan_account_id", "terms_version_id") REFERENCES "obligations"("id", "run_id", "loan_account_id", "terms_version_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_event_id_loan_account_id_fkey" FOREIGN KEY ("event_id", "loan_account_id") REFERENCES "financial_events"("id", "loan_account_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_snapshots" ADD CONSTRAINT "loan_snapshots_run_id_loan_account_id_fkey" FOREIGN KEY ("run_id", "loan_account_id") REFERENCES "calculation_runs"("id", "loan_account_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_entries" ADD CONSTRAINT "audit_entries_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_entries" ADD CONSTRAINT "audit_entries_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- SQL invariants not expressible in Prisma's schema language.
-- Keep these in migrations: db push alone does not install financial history guards.

-- Compatibility bridge: legacy API continues to supply userId, not workspaceId.
CREATE FUNCTION ensure_personal_workspace(owner_id TEXT) RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE result TEXT;
BEGIN
  SELECT id INTO result FROM workspaces WHERE personal_owner_id = owner_id;
  IF result IS NULL THEN
    INSERT INTO workspaces (id, name, personal_owner_id, updated_at)
    VALUES (md5('workspace:' || owner_id)::uuid::text, 'Личный кабинет', owner_id, CURRENT_TIMESTAMP)
    ON CONFLICT (personal_owner_id) DO NOTHING;
    SELECT id INTO result FROM workspaces WHERE personal_owner_id = owner_id;
  END IF;
  INSERT INTO workspace_members (id, workspace_id, user_id, role)
  VALUES (md5('workspace-owner:' || owner_id)::uuid::text, result, owner_id, 'OWNER')
  ON CONFLICT (workspace_id, user_id) DO NOTHING;
  RETURN result;
END $$;

SELECT ensure_personal_workspace(id) FROM users;
UPDATE borrowers b SET "workspaceId" = w.id FROM workspaces w WHERE w.personal_owner_id = b."userId";
UPDATE collaterals c SET "workspaceId" = w.id FROM workspaces w WHERE w.personal_owner_id = c."userId";
UPDATE deals d SET "workspaceId" = w.id FROM workspaces w WHERE w.personal_owner_id = d."userId";

CREATE FUNCTION initialize_user_workspace() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  PERFORM ensure_personal_workspace(NEW.id);
  RETURN NEW;
END $$;
CREATE TRIGGER users_initialize_workspace AFTER INSERT ON users FOR EACH ROW EXECUTE FUNCTION initialize_user_workspace();

CREATE FUNCTION assign_legacy_workspace() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."workspaceId" IS NULL THEN
    NEW."workspaceId" := ensure_personal_workspace(NEW."userId");
  END IF;
  IF NOT EXISTS (SELECT 1 FROM workspace_members WHERE workspace_id = NEW."workspaceId" AND user_id = NEW."userId") THEN
    RAISE EXCEPTION 'Legacy record owner is not a workspace member' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'UPDATE' AND (NEW."workspaceId" IS DISTINCT FROM OLD."workspaceId" OR NEW."userId" IS DISTINCT FROM OLD."userId") THEN
    RAISE EXCEPTION 'Legacy ownership transfer requires an explicit migration' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER borrowers_assign_workspace BEFORE INSERT OR UPDATE ON borrowers FOR EACH ROW EXECUTE FUNCTION assign_legacy_workspace();
CREATE TRIGGER collaterals_assign_workspace BEFORE INSERT OR UPDATE ON collaterals FOR EACH ROW EXECUTE FUNCTION assign_legacy_workspace();
CREATE TRIGGER deals_assign_workspace BEFORE INSERT OR UPDATE ON deals FOR EACH ROW EXECUTE FUNCTION assign_legacy_workspace();
ALTER TABLE borrowers ADD CONSTRAINT borrowers_workspace_required CHECK ("workspaceId" IS NOT NULL);
ALTER TABLE collaterals ADD CONSTRAINT collaterals_workspace_required CHECK ("workspaceId" IS NOT NULL);
ALTER TABLE deals ADD CONSTRAINT deals_workspace_required CHECK ("workspaceId" IS NOT NULL);

CREATE FUNCTION check_legacy_deal_scope() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."borrowerId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM borrowers WHERE id = NEW."borrowerId" AND "workspaceId" = NEW."workspaceId") THEN
    RAISE EXCEPTION 'Borrower belongs to another workspace' USING ERRCODE = '23514';
  END IF;
  IF NEW."collateralId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM collaterals WHERE id = NEW."collateralId" AND "workspaceId" = NEW."workspaceId") THEN
    RAISE EXCEPTION 'Collateral belongs to another workspace' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
-- PostgreSQL runs same-kind triggers in alphabetical order; assignment must run first.
CREATE TRIGGER deals_check_workspace BEFORE INSERT OR UPDATE ON deals FOR EACH ROW EXECUTE FUNCTION check_legacy_deal_scope();

ALTER TABLE contract_collaterals ADD CONSTRAINT contract_collaterals_values CHECK ((secured_amount IS NULL OR secured_amount >= 0) AND priority > 0 AND currency ~ '^[A-Z]{3}$');
ALTER TABLE loan_accounts ADD CONSTRAINT loan_accounts_currency CHECK (currency ~ '^[A-Z]{3}$');
ALTER TABLE terms_versions ADD CONSTRAINT terms_versions_values CHECK (version_no > 0 AND contract_amount > 0 AND jsonb_typeof(day_count_policy) = 'object' AND jsonb_typeof(rounding_policy) = 'object' AND content_hash ~ '^[0-9a-f]{64}$');
ALTER TABLE calendar_versions ADD CONSTRAINT calendar_versions_hash CHECK (content_hash ~ '^[0-9a-f]{64}$');
ALTER TABLE documents ADD CONSTRAINT documents_hash CHECK (sha256 ~ '^[0-9a-f]{64}$');
ALTER TABLE term_rules ADD CONSTRAINT term_rules_definition CHECK (jsonb_typeof(definition) = 'object' AND priority >= 0 AND length(trim(rule_key)) > 0 AND length(trim(source_clause)) > 0);
ALTER TABLE financial_events ADD CONSTRAINT financial_events_values CHECK (
  sequence_no > 0 AND (amount IS NULL OR amount > 0) AND jsonb_typeof(payload) = 'object'
  AND length(trim(idempotency_key)) > 0
  AND (kind NOT IN ('DISBURSEMENT','RECEIPT','EXPENSE','WAIVER') OR amount IS NOT NULL)
  AND (kind <> 'NOTICE' OR amount IS NULL)
  AND ((kind = 'REVERSAL') = (reverses_event_id IS NOT NULL))
  AND reverses_event_id IS DISTINCT FROM id
);
ALTER TABLE calculation_runs ADD CONSTRAINT calculation_runs_values CHECK (input_hash ~ '^[0-9a-f]{64}$' AND supersedes_run_id IS DISTINCT FROM id);
ALTER TABLE calculation_inputs ADD CONSTRAINT calculation_inputs_hash CHECK (content_hash ~ '^[0-9a-f]{64}$');
ALTER TABLE obligations ADD CONSTRAINT obligations_values CHECK (amount >= 0 AND unpaid_amount >= 0 AND unpaid_amount <= amount AND (period_from IS NULL) = (period_to IS NULL) AND (period_to IS NULL OR period_to >= period_from));
ALTER TABLE accrual_lines ADD CONSTRAINT accrual_lines_values CHECK (base_amount >= 0 AND rate >= 0 AND day_count >= 0 AND period_to >= period_from AND jsonb_typeof(explanation) = 'object');
ALTER TABLE payment_allocations ADD CONSTRAINT payment_allocations_values CHECK (amount > 0 AND order_no > 0);
ALTER TABLE loan_snapshots ADD CONSTRAINT loan_snapshots_values CHECK (
  principal_outstanding >= 0 AND interest_unpaid >= 0 AND penalty_unpaid >= 0 AND expenses_unpaid >= 0 AND unapplied_credit >= 0
  AND due_total >= 0 AND overdue_total >= 0 AND overdue_total <= due_total AND days_past_due >= 0
  AND (next_payment_on IS NULL) = (next_payment_amount IS NULL)
  AND (next_payment_amount IS NULL OR next_payment_amount >= 0) AND (payoff_amount IS NULL OR payoff_amount >= 0)
  AND jsonb_typeof(diagnostics) = 'object'
);

CREATE FUNCTION guard_loan_identity() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND (NEW.contract_id, NEW.workspace_id, NEW.currency) IS DISTINCT FROM (OLD.contract_id, OLD.workspace_id, OLD.currency) THEN
    RAISE EXCEPTION 'Loan identity and currency are immutable' USING ERRCODE = '23514';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM contracts WHERE id = NEW.contract_id AND kind = 'LOAN' FOR SHARE) THEN
    RAISE EXCEPTION 'Loan account requires a loan contract' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER loan_accounts_guard BEFORE INSERT OR UPDATE ON loan_accounts FOR EACH ROW EXECUTE FUNCTION guard_loan_identity();
CREATE FUNCTION guard_contract_kind() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.kind <> 'LOAN' AND EXISTS (SELECT 1 FROM loan_accounts WHERE contract_id = OLD.id) THEN
    RAISE EXCEPTION 'A loan contract with an account cannot change kind' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER contracts_guard_kind BEFORE UPDATE ON contracts FOR EACH ROW EXECUTE FUNCTION guard_contract_kind();

CREATE FUNCTION reject_history_mutation() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% is append-only; record a correction instead', TG_TABLE_NAME USING ERRCODE = '23514';
END $$;
CREATE TRIGGER financial_events_append_only BEFORE UPDATE OR DELETE ON financial_events FOR EACH ROW EXECUTE FUNCTION reject_history_mutation();
CREATE TRIGGER audit_entries_append_only BEFORE UPDATE OR DELETE ON audit_entries FOR EACH ROW EXECUTE FUNCTION reject_history_mutation();

CREATE FUNCTION validate_event_reversal() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE original financial_events%ROWTYPE;
BEGIN
  IF NEW.kind = 'REVERSAL' THEN
    SELECT * INTO original FROM financial_events WHERE id = NEW.reverses_event_id AND loan_account_id = NEW.loan_account_id FOR SHARE;
    IF NOT FOUND OR original.kind = 'REVERSAL' OR NEW.amount IS DISTINCT FROM original.amount OR NEW.sequence_no <= original.sequence_no OR NEW.effective_on < original.effective_on THEN
      RAISE EXCEPTION 'Reversal must fully compensate an earlier original event in the same loan' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER financial_events_validate_reversal BEFORE INSERT ON financial_events FOR EACH ROW EXECUTE FUNCTION validate_event_reversal();

CREATE FUNCTION guard_published_version() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'DRAFT' THEN RAISE EXCEPTION 'Create a draft, then publish its complete contents' USING ERRCODE = '23514'; END IF;
    RETURN NEW;
  END IF;
  IF OLD.status = 'PUBLISHED' THEN
    RAISE EXCEPTION 'Published % is immutable', TG_TABLE_NAME USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  IF NEW.id <> OLD.id THEN RAISE EXCEPTION 'Version identity is immutable' USING ERRCODE = '23514'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER terms_versions_published_guard BEFORE INSERT OR UPDATE OR DELETE ON terms_versions FOR EACH ROW EXECUTE FUNCTION guard_published_version();
CREATE TRIGGER calendar_versions_published_guard BEFORE INSERT OR UPDATE OR DELETE ON calendar_versions FOR EACH ROW EXECUTE FUNCTION guard_published_version();

CREATE FUNCTION guard_version_child() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE parent_id TEXT; parent_status "PublicationStatus";
BEGIN
  IF TG_TABLE_NAME = 'term_rules' THEN
    IF TG_OP = 'UPDATE' AND (NEW.terms_version_id, NEW.loan_account_id) IS DISTINCT FROM (OLD.terms_version_id, OLD.loan_account_id) THEN RAISE EXCEPTION 'Cannot move a rule between versions' USING ERRCODE = '23514'; END IF;
    IF TG_OP = 'DELETE' THEN parent_id := OLD.terms_version_id; ELSE parent_id := NEW.terms_version_id; END IF;
    SELECT status INTO parent_status FROM terms_versions WHERE id = parent_id FOR UPDATE;
  ELSE
    IF TG_OP = 'UPDATE' AND NEW.calendar_version_id <> OLD.calendar_version_id THEN RAISE EXCEPTION 'Cannot move a day between calendar versions' USING ERRCODE = '23514'; END IF;
    IF TG_OP = 'DELETE' THEN parent_id := OLD.calendar_version_id; ELSE parent_id := NEW.calendar_version_id; END IF;
    SELECT status INTO parent_status FROM calendar_versions WHERE id = parent_id FOR UPDATE;
  END IF;
  IF parent_status = 'PUBLISHED' THEN RAISE EXCEPTION 'Cannot change contents of a published version' USING ERRCODE = '23514'; END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER term_rules_version_guard BEFORE INSERT OR UPDATE OR DELETE ON term_rules FOR EACH ROW EXECUTE FUNCTION guard_version_child();
CREATE TRIGGER calendar_days_version_guard BEFORE INSERT OR UPDATE OR DELETE ON calendar_days FOR EACH ROW EXECUTE FUNCTION guard_version_child();

CREATE FUNCTION validate_terms_publication() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'PUBLISHED' AND OLD.status = 'DRAFT' THEN
    IF NOT EXISTS (SELECT 1 FROM calendar_versions WHERE id = NEW.calendar_version_id AND status = 'PUBLISHED')
       OR NOT EXISTS (SELECT 1 FROM term_rules WHERE terms_version_id = NEW.id) THEN
      RAISE EXCEPTION 'Published terms require a published calendar and rules' USING ERRCODE = '23514';
    END IF;
    NEW.recorded_at := CURRENT_TIMESTAMP;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER terms_versions_validate_publication BEFORE UPDATE ON terms_versions FOR EACH ROW EXECUTE FUNCTION validate_terms_publication();

-- Lock the owning run to serialize result writes, prevent late writes after completion,
-- and make allocation limits safe against concurrent writers of the same run.
CREATE FUNCTION guard_calculation_child() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE owner_run TEXT; run_status "CalculationStatus";
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.run_id <> OLD.run_id THEN RAISE EXCEPTION 'Cannot move a result between runs' USING ERRCODE = '23514'; END IF;
  IF TG_OP = 'DELETE' THEN owner_run := OLD.run_id; ELSE owner_run := NEW.run_id; END IF;
  SELECT status INTO run_status FROM calculation_runs WHERE id = owner_run FOR UPDATE;
  IF run_status IS DISTINCT FROM 'RUNNING'::"CalculationStatus" THEN RAISE EXCEPTION 'Results may only change while a calculation is running' USING ERRCODE = '23514'; END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER calculation_inputs_00_guard BEFORE INSERT OR UPDATE OR DELETE ON calculation_inputs FOR EACH ROW EXECUTE FUNCTION guard_calculation_child();
CREATE TRIGGER obligations_00_guard BEFORE INSERT OR UPDATE OR DELETE ON obligations FOR EACH ROW EXECUTE FUNCTION guard_calculation_child();
CREATE TRIGGER accrual_lines_00_guard BEFORE INSERT OR UPDATE OR DELETE ON accrual_lines FOR EACH ROW EXECUTE FUNCTION guard_calculation_child();
CREATE TRIGGER payment_allocations_00_guard BEFORE INSERT OR UPDATE OR DELETE ON payment_allocations FOR EACH ROW EXECUTE FUNCTION guard_calculation_child();
CREATE TRIGGER loan_snapshots_00_guard BEFORE INSERT OR UPDATE OR DELETE ON loan_snapshots FOR EACH ROW EXECUTE FUNCTION guard_calculation_child();

CREATE FUNCTION validate_calculation_input() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE target_run calculation_runs%ROWTYPE; valid BOOLEAN := FALSE;
BEGIN
  SELECT * INTO target_run FROM calculation_runs WHERE id = NEW.run_id;
  CASE NEW.input_kind
    WHEN 'EVENT' THEN SELECT EXISTS (SELECT 1 FROM financial_events WHERE id = NEW.input_ref AND loan_account_id = NEW.loan_account_id AND recorded_at <= target_run.knowledge_cutoff AND effective_on <= target_run.as_of_on) INTO valid;
    WHEN 'TERMS_VERSION' THEN SELECT EXISTS (SELECT 1 FROM terms_versions WHERE id = NEW.input_ref AND loan_account_id = NEW.loan_account_id AND status = 'PUBLISHED' AND recorded_at <= target_run.knowledge_cutoff AND content_hash = NEW.content_hash) INTO valid;
    WHEN 'CALENDAR_VERSION' THEN SELECT EXISTS (SELECT 1 FROM calendar_versions WHERE id = NEW.input_ref AND status = 'PUBLISHED' AND content_hash = NEW.content_hash) INTO valid;
  END CASE;
  IF NOT valid THEN RAISE EXCEPTION 'Calculation input is missing, unpublished, outside the loan, or not known at cutoff' USING ERRCODE = '23514'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER calculation_inputs_validate BEFORE INSERT OR UPDATE ON calculation_inputs FOR EACH ROW EXECUTE FUNCTION validate_calculation_input();

CREATE FUNCTION validate_allocation() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE receipt financial_events%ROWTYPE; receipt_total NUMERIC; obligation_total NUMERIC; obligation_amount NUMERIC;
BEGIN
  SELECT * INTO receipt FROM financial_events WHERE id = NEW.event_id;
  IF receipt.kind IS DISTINCT FROM 'RECEIPT'::"FinancialEventKind" OR NOT EXISTS (SELECT 1 FROM calculation_inputs WHERE run_id = NEW.run_id AND input_kind = 'EVENT' AND input_ref = NEW.event_id) THEN
    RAISE EXCEPTION 'Allocation requires a receipt present in the calculation inputs' USING ERRCODE = '23514';
  END IF;
  SELECT COALESCE(sum(amount),0) INTO receipt_total FROM payment_allocations WHERE run_id = NEW.run_id AND event_id = NEW.event_id AND id <> NEW.id;
  SELECT COALESCE(sum(amount),0) INTO obligation_total FROM payment_allocations WHERE run_id = NEW.run_id AND obligation_id = NEW.obligation_id AND id <> NEW.id;
  SELECT amount INTO obligation_amount FROM obligations WHERE id = NEW.obligation_id AND run_id = NEW.run_id;
  IF receipt_total + NEW.amount > receipt.amount OR obligation_total + NEW.amount > obligation_amount THEN
    RAISE EXCEPTION 'Allocation exceeds receipt or obligation amount' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER payment_allocations_validate BEFORE INSERT OR UPDATE ON payment_allocations FOR EACH ROW EXECUTE FUNCTION validate_allocation();

CREATE FUNCTION guard_calculation_run() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'RUNNING' THEN RAISE EXCEPTION 'A calculation must start in RUNNING state' USING ERRCODE = '23514'; END IF;
    RETURN NEW;
  END IF;
  IF TG_OP = 'DELETE' OR OLD.status <> 'RUNNING' THEN RAISE EXCEPTION 'Calculation history cannot be deleted or rewritten' USING ERRCODE = '23514'; END IF;
  IF (to_jsonb(NEW) - 'status') IS DISTINCT FROM (to_jsonb(OLD) - 'status') THEN RAISE EXCEPTION 'Calculation identity and inputs cannot be changed' USING ERRCODE = '23514'; END IF;
  IF NEW.status = 'SUCCEEDED' THEN
    IF NOT EXISTS (SELECT 1 FROM loan_snapshots WHERE run_id = NEW.id)
       OR NOT EXISTS (SELECT 1 FROM calculation_inputs WHERE run_id = NEW.id AND input_kind = 'TERMS_VERSION')
       OR NOT EXISTS (SELECT 1 FROM calculation_inputs WHERE run_id = NEW.id AND input_kind = 'CALENDAR_VERSION') THEN
      RAISE EXCEPTION 'Successful calculation requires inputs and a snapshot' USING ERRCODE = '23514';
    END IF;
    IF EXISTS (
      SELECT 1 FROM (
        SELECT terms_version_id FROM obligations WHERE run_id = NEW.id
        UNION SELECT terms_version_id FROM accrual_lines WHERE run_id = NEW.id
      ) referenced WHERE NOT EXISTS (
        SELECT 1 FROM calculation_inputs i WHERE i.run_id = NEW.id AND i.input_kind = 'TERMS_VERSION' AND i.input_ref = referenced.terms_version_id
      )
    ) THEN
      RAISE EXCEPTION 'Results reference terms absent from input manifest' USING ERRCODE = '23514';
    END IF;
    IF EXISTS (
      SELECT 1 FROM calculation_inputs i JOIN terms_versions t ON t.id = i.input_ref
      WHERE i.run_id = NEW.id AND i.input_kind = 'TERMS_VERSION' AND NOT EXISTS (
        SELECT 1 FROM calculation_inputs c WHERE c.run_id = NEW.id AND c.input_kind = 'CALENDAR_VERSION' AND c.input_ref = t.calendar_version_id
      )
    ) THEN
      RAISE EXCEPTION 'Terms calendar is absent from input manifest' USING ERRCODE = '23514';
    END IF;
    IF EXISTS (
      SELECT 1 FROM obligations o WHERE o.run_id = NEW.id AND o.unpaid_amount <> o.amount - COALESCE((
        SELECT sum(a.amount) FROM payment_allocations a WHERE a.run_id = NEW.id AND a.obligation_id = o.id
      ),0)
    ) THEN
      RAISE EXCEPTION 'Unpaid obligation amount does not match its allocations' USING ERRCODE = '23514';
    END IF;
    IF EXISTS (
      SELECT 1 FROM payment_allocations a JOIN financial_events e ON e.id = a.event_id
      WHERE a.run_id = NEW.id AND (
        NOT EXISTS (SELECT 1 FROM calculation_inputs i WHERE i.run_id = NEW.id AND i.input_kind = 'EVENT' AND i.input_ref = e.id)
        OR EXISTS (
          SELECT 1 FROM calculation_inputs i JOIN financial_events reversal ON reversal.id = i.input_ref
          WHERE i.run_id = NEW.id AND i.input_kind = 'EVENT' AND reversal.reverses_event_id = e.id
        )
      )
    ) THEN
      RAISE EXCEPTION 'Allocation receipt is absent from inputs or reversed in this calculation' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER calculation_runs_guard BEFORE INSERT OR UPDATE OR DELETE ON calculation_runs FOR EACH ROW EXECUTE FUNCTION guard_calculation_run();

COMMIT;
