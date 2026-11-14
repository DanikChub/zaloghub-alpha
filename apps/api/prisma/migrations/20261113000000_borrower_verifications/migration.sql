BEGIN;

-- CreateEnum
CREATE TYPE "BorrowerVerificationStatus" AS ENUM ('DRAFT', 'IN_PROGRESS', 'AWAITING_DOCUMENTS', 'READY_FOR_REVIEW', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BorrowerRiskAssessment" AS ENUM ('NOT_ASSESSED', 'NOT_IDENTIFIED', 'NEEDS_REVIEW', 'IDENTIFIED');

-- CreateEnum
CREATE TYPE "BorrowerVerificationDecision" AS ENUM ('PENDING', 'APPROVED', 'APPROVED_WITH_CONDITIONS', 'REJECTED');

-- CreateEnum
CREATE TYPE "BorrowerCheckResultType" AS ENUM ('BOOLEAN', 'CATEGORY', 'MONEY', 'DOCUMENT', 'RECORD_LIST');

-- CreateEnum
CREATE TYPE "BorrowerCheckExecutionMode" AS ENUM ('MANUAL', 'AUTOMATIC', 'HYBRID');

-- CreateEnum
CREATE TYPE "BorrowerCheckRunMode" AS ENUM ('MANUAL', 'AUTOMATIC');

-- CreateEnum
CREATE TYPE "BorrowerCheckItemStatus" AS ENUM ('NOT_STARTED', 'MISSING_DATA', 'QUEUED', 'RUNNING', 'COMPLETED', 'ERROR', 'UNAVAILABLE', 'NOT_APPLICABLE', 'STALE');

-- CreateEnum
CREATE TYPE "BorrowerCheckRunStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BorrowerFindingType" AS ENUM ('COURT_CASE', 'ENFORCEMENT', 'BANKRUPTCY', 'LIST_MATCH', 'OTHER');

-- CreateEnum
CREATE TYPE "BorrowerIdentityMatch" AS ENUM ('CONFIRMED', 'POSSIBLE', 'REJECTED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "BorrowerEvidenceKind" AS ENUM ('PASSPORT', 'SNILS', 'CERTIFICATE', 'EXTRACT', 'SCREENSHOT', 'PROVIDER_RESPONSE', 'OTHER');

-- CreateEnum
CREATE TYPE "BorrowerEvidenceAuthenticity" AS ENUM ('NOT_CHECKED', 'CONFIRMED', 'DOUBTFUL', 'REJECTED');

-- CreateEnum
CREATE TYPE "BorrowerOcrStatus" AS ENUM ('NOT_REQUIRED', 'PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "BorrowerRiskSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "BorrowerRiskRemediability" AS ENUM ('REMEDIABLE', 'NON_REMEDIABLE', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "BorrowerRiskStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'DISMISSED');

-- AlterTable
ALTER TABLE "documents" ADD COLUMN     "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "original_filename" TEXT,
ADD COLUMN     "size_bytes" BIGINT;

-- CreateTable
CREATE TABLE "party_identity_versions" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "party_id" TEXT NOT NULL,
    "version_no" INTEGER NOT NULL,
    "supersedes_id" TEXT,
    "last_name" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "middle_name" TEXT,
    "has_no_middle_name" BOOLEAN NOT NULL DEFAULT false,
    "birth_date" DATE,
    "birth_place" TEXT,
    "passport_series" VARCHAR(4),
    "passport_number" VARCHAR(6),
    "passport_issued_on" DATE,
    "passport_issued_by" TEXT,
    "passport_department_code" VARCHAR(7),
    "registration_address" JSONB,
    "residential_address" JSONB,
    "previous_names" JSONB NOT NULL DEFAULT '[]',
    "previous_regions" JSONB NOT NULL DEFAULT '[]',
    "inn" VARCHAR(12),
    "snils" VARCHAR(11),
    "ogrnip" VARCHAR(15),
    "source_document_id" TEXT,
    "confirmed_by_id" TEXT NOT NULL,
    "confirmed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "party_identity_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "borrower_verifications" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "party_id" TEXT NOT NULL,
    "identity_version_id" TEXT,
    "deal_id" TEXT,
    "previous_verification_id" TEXT,
    "checklist_version" TEXT NOT NULL,
    "risk_rules_version" TEXT NOT NULL,
    "status" "BorrowerVerificationStatus" NOT NULL DEFAULT 'DRAFT',
    "overall_risk" "BorrowerRiskAssessment" NOT NULL DEFAULT 'NOT_ASSESSED',
    "decision" "BorrowerVerificationDecision" NOT NULL DEFAULT 'PENDING',
    "decision_comment" TEXT,
    "decision_conditions" TEXT,
    "assigned_to_id" TEXT,
    "created_by_id" TEXT NOT NULL,
    "decided_by_id" TEXT,
    "decided_at" TIMESTAMPTZ(3),
    "completed_at" TIMESTAMPTZ(3),
    "valid_until" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "borrower_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "borrower_verification_items" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "verification_id" TEXT NOT NULL,
    "check_code" TEXT NOT NULL,
    "definition_version" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_required" BOOLEAN NOT NULL DEFAULT true,
    "result_type" "BorrowerCheckResultType" NOT NULL,
    "input_schema" JSONB NOT NULL DEFAULT '{}',
    "result_schema" JSONB NOT NULL DEFAULT '{}',
    "source_code" TEXT,
    "source_url" TEXT,
    "instructions" TEXT,
    "execution_mode" "BorrowerCheckExecutionMode" NOT NULL DEFAULT 'MANUAL',
    "status" "BorrowerCheckItemStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "accepted_run_id" TEXT,
    "not_applicable_reason" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "borrower_verification_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "borrower_check_runs" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "verification_id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "attempt_no" INTEGER NOT NULL,
    "mode" "BorrowerCheckRunMode" NOT NULL,
    "provider_code" TEXT,
    "provider_request_id" TEXT,
    "idempotency_key" TEXT NOT NULL,
    "input_snapshot" JSONB NOT NULL,
    "input_hash" TEXT NOT NULL,
    "adapter_version" TEXT,
    "status" "BorrowerCheckRunStatus" NOT NULL DEFAULT 'QUEUED',
    "result_boolean" BOOLEAN,
    "result_code" TEXT,
    "result_amount" DECIMAL(20,2),
    "currency" CHAR(3),
    "result_data" JSONB NOT NULL DEFAULT '{}',
    "summary" TEXT,
    "risk_assessment" "BorrowerRiskAssessment" NOT NULL DEFAULT 'NOT_ASSESSED',
    "assessment_rules_version" TEXT NOT NULL,
    "coverage" JSONB NOT NULL DEFAULT '{}',
    "source_as_of_at" TIMESTAMPTZ(3),
    "valid_until" TIMESTAMPTZ(3),
    "error_code" TEXT,
    "error_message" TEXT,
    "performed_by_id" TEXT,
    "reviewed_by_id" TEXT,
    "reviewed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMPTZ(3),
    "finished_at" TIMESTAMPTZ(3),
    "available_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lease_owner" TEXT,
    "lease_expires_at" TIMESTAMPTZ(3),
    "heartbeat_at" TIMESTAMPTZ(3),
    "identity_version_id" TEXT NOT NULL,

    CONSTRAINT "borrower_check_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "borrower_check_findings" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "verification_id" TEXT NOT NULL,
    "run_id" TEXT NOT NULL,
    "finding_type" "BorrowerFindingType" NOT NULL,
    "external_id" TEXT,
    "record_key" TEXT NOT NULL,
    "reference_number" TEXT,
    "title" TEXT NOT NULL,
    "category_code" TEXT,
    "person_role" TEXT,
    "record_status" TEXT,
    "opened_on" DATE,
    "closed_on" DATE,
    "claim_amount" DECIMAL(20,2),
    "outstanding_amount" DECIMAL(20,2),
    "currency" CHAR(3),
    "authority_name" TEXT,
    "source_url" TEXT,
    "identity_match" "BorrowerIdentityMatch" NOT NULL DEFAULT 'UNKNOWN',
    "match_basis" JSONB NOT NULL DEFAULT '{}',
    "match_comment" TEXT,
    "match_reviewed_by_id" TEXT,
    "match_reviewed_at" TIMESTAMPTZ(3),
    "details" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "borrower_check_findings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "borrower_verification_evidence" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "verification_id" TEXT NOT NULL,
    "item_id" TEXT,
    "run_id" TEXT,
    "finding_id" TEXT,
    "document_id" TEXT,
    "kind" "BorrowerEvidenceKind" NOT NULL,
    "title" TEXT NOT NULL,
    "source_url" TEXT,
    "issued_on" DATE,
    "captured_at" TIMESTAMPTZ(3),
    "valid_until" TIMESTAMPTZ(3),
    "authenticity_status" "BorrowerEvidenceAuthenticity" NOT NULL DEFAULT 'NOT_CHECKED',
    "ocr_status" "BorrowerOcrStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
    "ocr_engine_version" TEXT,
    "ocr_result" JSONB,
    "ocr_error" TEXT,
    "review_comment" TEXT,
    "reviewed_by_id" TEXT,
    "reviewed_at" TIMESTAMPTZ(3),
    "uploaded_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "borrower_verification_evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "borrower_verification_risks" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "verification_id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "run_id" TEXT NOT NULL,
    "finding_id" TEXT,
    "risk_code" TEXT NOT NULL,
    "rule_version" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "severity" "BorrowerRiskSeverity" NOT NULL,
    "remediability" "BorrowerRiskRemediability" NOT NULL DEFAULT 'UNKNOWN',
    "status" "BorrowerRiskStatus" NOT NULL DEFAULT 'OPEN',
    "required_action" TEXT,
    "assigned_to_id" TEXT,
    "due_at" TIMESTAMPTZ(3),
    "resolution_comment" TEXT,
    "resolution_evidence_id" TEXT,
    "resolved_by_id" TEXT,
    "resolved_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "borrower_verification_risks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "party_identity_versions_workspace_idx" ON "party_identity_versions"("workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "party_identity_versions_scope_key" ON "party_identity_versions"("id", "workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "identity_party_scope_key" ON "party_identity_versions"("id", "party_id", "workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "identity_party_version_key" ON "party_identity_versions"("party_id", "version_no");

-- CreateIndex
CREATE INDEX "borrower_verifications_workspace_idx" ON "borrower_verifications"("workspace_id");

-- CreateIndex
CREATE INDEX "verification_party_created_idx" ON "borrower_verifications"("workspace_id", "party_id", "created_at");

-- CreateIndex
CREATE INDEX "verification_status_created_idx" ON "borrower_verifications"("workspace_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "verification_risk_created_idx" ON "borrower_verifications"("workspace_id", "overall_risk", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "borrower_verifications_scope_key" ON "borrower_verifications"("id", "workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "verification_party_scope_key" ON "borrower_verifications"("id", "party_id", "workspace_id");

-- CreateIndex
CREATE INDEX "borrower_verification_items_workspace_idx" ON "borrower_verification_items"("workspace_id");

-- CreateIndex
CREATE INDEX "item_status_idx" ON "borrower_verification_items"("verification_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "borrower_verification_items_scope_key" ON "borrower_verification_items"("id", "workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "item_verification_scope_key" ON "borrower_verification_items"("id", "verification_id", "workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "item_check_code_key" ON "borrower_verification_items"("verification_id", "check_code");

-- CreateIndex
CREATE INDEX "borrower_check_runs_workspace_idx" ON "borrower_check_runs"("workspace_id");

-- CreateIndex
CREATE INDEX "run_item_created_idx" ON "borrower_check_runs"("item_id", "created_at");

-- CreateIndex
CREATE INDEX "run_queue_idx" ON "borrower_check_runs"("status", "available_at");

-- CreateIndex
CREATE UNIQUE INDEX "borrower_check_runs_scope_key" ON "borrower_check_runs"("id", "workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "run_item_scope_key" ON "borrower_check_runs"("id", "item_id", "verification_id", "workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "run_verification_scope_key" ON "borrower_check_runs"("id", "verification_id", "workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "run_attempt_key" ON "borrower_check_runs"("item_id", "attempt_no");

-- CreateIndex
CREATE UNIQUE INDEX "run_idempotency_key" ON "borrower_check_runs"("item_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "borrower_check_findings_workspace_idx" ON "borrower_check_findings"("workspace_id");

-- CreateIndex
CREATE INDEX "finding_match_idx" ON "borrower_check_findings"("workspace_id", "finding_type", "identity_match");

-- CreateIndex
CREATE UNIQUE INDEX "borrower_check_findings_scope_key" ON "borrower_check_findings"("id", "workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "finding_run_scope_key" ON "borrower_check_findings"("id", "run_id", "verification_id", "workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "finding_record_key" ON "borrower_check_findings"("run_id", "record_key");

-- CreateIndex
CREATE INDEX "borrower_verification_evidence_workspace_idx" ON "borrower_verification_evidence"("workspace_id");

-- CreateIndex
CREATE INDEX "evidence_kind_idx" ON "borrower_verification_evidence"("verification_id", "kind");

-- CreateIndex
CREATE INDEX "evidence_document_idx" ON "borrower_verification_evidence"("document_id", "workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "borrower_verification_evidence_scope_key" ON "borrower_verification_evidence"("id", "workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "evidence_verification_scope_key" ON "borrower_verification_evidence"("id", "verification_id", "workspace_id");

-- CreateIndex
CREATE INDEX "borrower_verification_risks_workspace_idx" ON "borrower_verification_risks"("workspace_id");

-- CreateIndex
CREATE INDEX "risk_status_severity_idx" ON "borrower_verification_risks"("workspace_id", "status", "severity");

-- CreateIndex
CREATE INDEX "risk_verification_status_idx" ON "borrower_verification_risks"("verification_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "borrower_verification_risks_scope_key" ON "borrower_verification_risks"("id", "workspace_id");

-- AddForeignKey
ALTER TABLE "party_identity_versions" ADD CONSTRAINT "party_identity_versions_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "party_identity_versions" ADD CONSTRAINT "party_identity_versions_party_id_workspace_id_fkey" FOREIGN KEY ("party_id", "workspace_id") REFERENCES "parties"("id", "workspace_id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "party_identity_versions" ADD CONSTRAINT "party_identity_versions_supersedes_id_party_id_workspace_i_fkey" FOREIGN KEY ("supersedes_id", "party_id", "workspace_id") REFERENCES "party_identity_versions"("id", "party_id", "workspace_id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "party_identity_versions" ADD CONSTRAINT "party_identity_versions_source_document_id_workspace_id_fkey" FOREIGN KEY ("source_document_id", "workspace_id") REFERENCES "documents"("id", "workspace_id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "party_identity_versions" ADD CONSTRAINT "party_identity_versions_confirmed_by_id_fkey" FOREIGN KEY ("confirmed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "borrower_verifications" ADD CONSTRAINT "borrower_verifications_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "borrower_verifications" ADD CONSTRAINT "borrower_verifications_party_id_workspace_id_fkey" FOREIGN KEY ("party_id", "workspace_id") REFERENCES "parties"("id", "workspace_id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "borrower_verifications" ADD CONSTRAINT "borrower_verifications_identity_version_id_party_id_worksp_fkey" FOREIGN KEY ("identity_version_id", "party_id", "workspace_id") REFERENCES "party_identity_versions"("id", "party_id", "workspace_id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "borrower_verifications" ADD CONSTRAINT "borrower_verifications_deal_id_workspace_id_fkey" FOREIGN KEY ("deal_id", "workspace_id") REFERENCES "deals"("id", "workspaceId") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "borrower_verifications" ADD CONSTRAINT "borrower_verifications_previous_verification_id_party_id_w_fkey" FOREIGN KEY ("previous_verification_id", "party_id", "workspace_id") REFERENCES "borrower_verifications"("id", "party_id", "workspace_id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "borrower_verifications" ADD CONSTRAINT "borrower_verifications_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "borrower_verifications" ADD CONSTRAINT "borrower_verifications_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "borrower_verifications" ADD CONSTRAINT "borrower_verifications_decided_by_id_fkey" FOREIGN KEY ("decided_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "borrower_verification_items" ADD CONSTRAINT "borrower_verification_items_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "borrower_verification_items" ADD CONSTRAINT "borrower_verification_items_verification_id_workspace_id_fkey" FOREIGN KEY ("verification_id", "workspace_id") REFERENCES "borrower_verifications"("id", "workspace_id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "borrower_verification_items" ADD CONSTRAINT "borrower_verification_items_accepted_run_id_id_verificatio_fkey" FOREIGN KEY ("accepted_run_id", "id", "verification_id", "workspace_id") REFERENCES "borrower_check_runs"("id", "item_id", "verification_id", "workspace_id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "borrower_check_runs" ADD CONSTRAINT "borrower_check_runs_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "borrower_check_runs" ADD CONSTRAINT "borrower_check_runs_item_id_verification_id_workspace_id_fkey" FOREIGN KEY ("item_id", "verification_id", "workspace_id") REFERENCES "borrower_verification_items"("id", "verification_id", "workspace_id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "borrower_check_runs" ADD CONSTRAINT "borrower_check_runs_performed_by_id_fkey" FOREIGN KEY ("performed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "borrower_check_runs" ADD CONSTRAINT "borrower_check_runs_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "borrower_check_runs" ADD CONSTRAINT "borrower_check_runs_identity_version_id_workspace_id_fkey" FOREIGN KEY ("identity_version_id", "workspace_id") REFERENCES "party_identity_versions"("id", "workspace_id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "borrower_check_findings" ADD CONSTRAINT "borrower_check_findings_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "borrower_check_findings" ADD CONSTRAINT "borrower_check_findings_run_id_verification_id_workspace_i_fkey" FOREIGN KEY ("run_id", "verification_id", "workspace_id") REFERENCES "borrower_check_runs"("id", "verification_id", "workspace_id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "borrower_check_findings" ADD CONSTRAINT "borrower_check_findings_match_reviewed_by_id_fkey" FOREIGN KEY ("match_reviewed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "borrower_verification_evidence" ADD CONSTRAINT "borrower_verification_evidence_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "borrower_verification_evidence" ADD CONSTRAINT "borrower_verification_evidence_verification_id_workspace_i_fkey" FOREIGN KEY ("verification_id", "workspace_id") REFERENCES "borrower_verifications"("id", "workspace_id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "borrower_verification_evidence" ADD CONSTRAINT "borrower_verification_evidence_item_id_verification_id_wor_fkey" FOREIGN KEY ("item_id", "verification_id", "workspace_id") REFERENCES "borrower_verification_items"("id", "verification_id", "workspace_id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "borrower_verification_evidence" ADD CONSTRAINT "borrower_verification_evidence_run_id_item_id_verification_fkey" FOREIGN KEY ("run_id", "item_id", "verification_id", "workspace_id") REFERENCES "borrower_check_runs"("id", "item_id", "verification_id", "workspace_id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "borrower_verification_evidence" ADD CONSTRAINT "borrower_verification_evidence_finding_id_run_id_verificat_fkey" FOREIGN KEY ("finding_id", "run_id", "verification_id", "workspace_id") REFERENCES "borrower_check_findings"("id", "run_id", "verification_id", "workspace_id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "borrower_verification_evidence" ADD CONSTRAINT "borrower_verification_evidence_document_id_workspace_id_fkey" FOREIGN KEY ("document_id", "workspace_id") REFERENCES "documents"("id", "workspace_id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "borrower_verification_evidence" ADD CONSTRAINT "borrower_verification_evidence_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "borrower_verification_evidence" ADD CONSTRAINT "borrower_verification_evidence_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "borrower_verification_risks" ADD CONSTRAINT "borrower_verification_risks_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "borrower_verification_risks" ADD CONSTRAINT "borrower_verification_risks_run_id_item_id_verification_id_fkey" FOREIGN KEY ("run_id", "item_id", "verification_id", "workspace_id") REFERENCES "borrower_check_runs"("id", "item_id", "verification_id", "workspace_id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "borrower_verification_risks" ADD CONSTRAINT "borrower_verification_risks_finding_id_run_id_verification_fkey" FOREIGN KEY ("finding_id", "run_id", "verification_id", "workspace_id") REFERENCES "borrower_check_findings"("id", "run_id", "verification_id", "workspace_id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "borrower_verification_risks" ADD CONSTRAINT "borrower_verification_risks_resolution_evidence_id_verific_fkey" FOREIGN KEY ("resolution_evidence_id", "verification_id", "workspace_id") REFERENCES "borrower_verification_evidence"("id", "verification_id", "workspace_id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "borrower_verification_risks" ADD CONSTRAINT "borrower_verification_risks_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "borrower_verification_risks" ADD CONSTRAINT "borrower_verification_risks_resolved_by_id_fkey" FOREIGN KEY ("resolved_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- SQL-only invariants supplement the Prisma model. No legacy rows are rewritten.
ALTER TABLE documents ADD CONSTRAINT documents_size_bytes_check CHECK (size_bytes IS NULL OR size_bytes >= 0);
ALTER TABLE party_identity_versions
  ADD CONSTRAINT identity_version_positive CHECK (version_no > 0),
  ADD CONSTRAINT identity_not_self CHECK (supersedes_id IS DISTINCT FROM id),
  ADD CONSTRAINT identity_names_check CHECK (btrim(first_name) <> '' AND btrim(last_name) <> '' AND (NOT has_no_middle_name OR middle_name IS NULL)),
  ADD CONSTRAINT identity_identifiers_check CHECK (
    (passport_series IS NULL OR passport_series ~ '^[0-9]{4}$') AND
    (passport_number IS NULL OR passport_number ~ '^[0-9]{6}$') AND
    (passport_department_code IS NULL OR passport_department_code ~ '^[0-9]{3}-[0-9]{3}$') AND
    (inn IS NULL OR inn ~ '^[0-9]{12}$') AND (snils IS NULL OR snils ~ '^[0-9]{11}$') AND
    (ogrnip IS NULL OR ogrnip ~ '^[0-9]{15}$')),
  ADD CONSTRAINT identity_dates_check CHECK (birth_date IS NULL OR passport_issued_on IS NULL OR passport_issued_on >= birth_date),
  ADD CONSTRAINT identity_json_check CHECK (
    (registration_address IS NULL OR jsonb_typeof(registration_address) = 'object') AND
    (residential_address IS NULL OR jsonb_typeof(residential_address) = 'object') AND
    jsonb_typeof(previous_names) = 'array' AND jsonb_typeof(previous_regions) = 'array');
ALTER TABLE borrower_verifications
  ADD CONSTRAINT verification_not_self CHECK (previous_verification_id IS DISTINCT FROM id),
  ADD CONSTRAINT verification_versions_check CHECK (btrim(checklist_version) <> '' AND btrim(risk_rules_version) <> ''),
  ADD CONSTRAINT verification_completion_check CHECK (
    (status = 'COMPLETED' AND identity_version_id IS NOT NULL AND decision <> 'PENDING' AND decided_by_id IS NOT NULL AND decided_at IS NOT NULL AND completed_at IS NOT NULL)
    OR (status <> 'COMPLETED' AND decision = 'PENDING' AND decided_by_id IS NULL AND decided_at IS NULL AND completed_at IS NULL)),
  ADD CONSTRAINT verification_conditions_check CHECK (decision <> 'APPROVED_WITH_CONDITIONS' OR NULLIF(btrim(decision_conditions),'') IS NOT NULL);
ALTER TABLE borrower_verification_items
  ADD CONSTRAINT item_definition_check CHECK (btrim(check_code) <> '' AND btrim(definition_version) <> '' AND btrim(title) <> ''),
  ADD CONSTRAINT item_schema_check CHECK (jsonb_typeof(input_schema) = 'object' AND jsonb_typeof(result_schema) = 'object'),
  ADD CONSTRAINT item_completion_check CHECK (status <> 'COMPLETED' OR accepted_run_id IS NOT NULL),
  ADD CONSTRAINT item_applicability_check CHECK (status <> 'NOT_APPLICABLE' OR NULLIF(btrim(not_applicable_reason),'') IS NOT NULL);
ALTER TABLE borrower_check_runs
  ADD CONSTRAINT run_attempt_positive CHECK (attempt_no > 0),
  ADD CONSTRAINT run_keys_check CHECK (btrim(idempotency_key) <> '' AND input_hash ~ '^[a-f0-9]{64}$' AND btrim(assessment_rules_version) <> ''),
  ADD CONSTRAINT run_json_check CHECK (jsonb_typeof(input_snapshot)='object' AND jsonb_typeof(result_data)='object' AND jsonb_typeof(coverage)='object'),
  ADD CONSTRAINT run_amount_check CHECK (result_amount IS NULL OR (result_amount >= 0 AND currency IS NOT NULL AND currency ~ '^[A-Z]{3}$')),
  ADD CONSTRAINT run_terminal_check CHECK ((status IN ('SUCCEEDED','FAILED','CANCELLED')) = (finished_at IS NOT NULL)),
  ADD CONSTRAINT run_started_check CHECK (status <> 'RUNNING' OR started_at IS NOT NULL),
  ADD CONSTRAINT run_dates_check CHECK ((started_at IS NULL OR started_at >= created_at) AND (finished_at IS NULL OR finished_at >= COALESCE(started_at,created_at))),
  ADD CONSTRAINT run_failure_check CHECK (status NOT IN ('FAILED','CANCELLED') OR (risk_assessment='NOT_ASSESSED' AND result_boolean IS NULL AND result_code IS NULL AND result_amount IS NULL)),
  ADD CONSTRAINT run_error_check CHECK (status <> 'FAILED' OR NULLIF(btrim(error_code),'') IS NOT NULL),
  ADD CONSTRAINT run_manual_check CHECK (mode <> 'MANUAL' OR performed_by_id IS NOT NULL),
  ADD CONSTRAINT run_review_check CHECK ((reviewed_by_id IS NULL) = (reviewed_at IS NULL)),
  ADD CONSTRAINT run_lease_check CHECK ((lease_owner IS NULL) = (lease_expires_at IS NULL) AND (lease_owner IS NULL OR (mode='AUTOMATIC' AND status='RUNNING')));
ALTER TABLE borrower_check_findings
  ADD CONSTRAINT finding_json_check CHECK (jsonb_typeof(match_basis)='object' AND jsonb_typeof(details)='object'),
  ADD CONSTRAINT finding_key_check CHECK (btrim(record_key) <> '' AND btrim(title) <> ''),
  ADD CONSTRAINT finding_amount_check CHECK ((claim_amount IS NULL OR claim_amount >= 0) AND (outstanding_amount IS NULL OR outstanding_amount >= 0) AND ((claim_amount IS NULL AND outstanding_amount IS NULL) OR (currency IS NOT NULL AND currency ~ '^[A-Z]{3}$'))),
  ADD CONSTRAINT finding_dates_check CHECK (opened_on IS NULL OR closed_on IS NULL OR closed_on >= opened_on),
  ADD CONSTRAINT finding_review_check CHECK ((match_reviewed_by_id IS NULL) = (match_reviewed_at IS NULL));
ALTER TABLE borrower_verification_evidence
  ADD CONSTRAINT evidence_content_check CHECK (document_id IS NOT NULL OR NULLIF(btrim(source_url),'') IS NOT NULL),
  ADD CONSTRAINT evidence_scope_check CHECK ((run_id IS NULL OR item_id IS NOT NULL) AND (finding_id IS NULL OR run_id IS NOT NULL)),
  ADD CONSTRAINT evidence_ocr_check CHECK ((ocr_result IS NULL OR jsonb_typeof(ocr_result)='object') AND (ocr_status='NOT_REQUIRED' OR document_id IS NOT NULL) AND (ocr_status <> 'SUCCEEDED' OR ocr_result IS NOT NULL) AND (ocr_status <> 'FAILED' OR NULLIF(btrim(ocr_error),'') IS NOT NULL)),
  ADD CONSTRAINT evidence_review_check CHECK ((reviewed_by_id IS NULL) = (reviewed_at IS NULL));
ALTER TABLE borrower_verification_risks
  ADD CONSTRAINT risk_text_check CHECK (btrim(risk_code) <> '' AND btrim(rule_version) <> '' AND btrim(title) <> '' AND btrim(description) <> ''),
  ADD CONSTRAINT risk_resolution_check CHECK (
    (status IN ('RESOLVED','DISMISSED') AND resolved_by_id IS NOT NULL AND resolved_at IS NOT NULL AND NULLIF(btrim(resolution_comment),'') IS NOT NULL)
    OR (status IN ('OPEN','IN_PROGRESS') AND resolved_by_id IS NULL AND resolved_at IS NULL)),
  ADD CONSTRAINT risk_resolution_evidence_check CHECK (status <> 'RESOLVED' OR resolution_evidence_id IS NOT NULL);
CREATE UNIQUE INDEX risk_rule_finding_key ON borrower_verification_risks(run_id,risk_code,rule_version,COALESCE(finding_id,''));

CREATE FUNCTION guard_party_identity_version() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'Confirmed identity history is immutable' USING ERRCODE='23514';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM parties WHERE id=NEW.party_id AND workspace_id=NEW.workspace_id AND kind IN ('PERSON','ENTREPRENEUR')) THEN
    RAISE EXCEPTION 'Identity requires a person or entrepreneur in the workspace' USING ERRCODE='23514';
  END IF;
  IF NEW.supersedes_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM party_identity_versions WHERE id=NEW.supersedes_id AND party_id=NEW.party_id AND workspace_id=NEW.workspace_id AND version_no < NEW.version_no) THEN
    RAISE EXCEPTION 'Identity predecessor must be an earlier version of the same person' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER identity_history_guard BEFORE INSERT OR UPDATE OR DELETE ON party_identity_versions FOR EACH ROW EXECUTE FUNCTION guard_party_identity_version();

-- Serialize child writes and finalization on the owning verification. History has no DELETE route.
CREATE FUNCTION guard_verification_child() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE owner_status "BorrowerVerificationStatus"; run_status "BorrowerCheckRunStatus"; result_kind "BorrowerCheckResultType";
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Verification history cannot be deleted' USING ERRCODE='23514'; END IF;
  IF TG_OP='UPDATE' AND (NEW.id IS DISTINCT FROM OLD.id OR NEW.workspace_id IS DISTINCT FROM OLD.workspace_id OR NEW.verification_id IS DISTINCT FROM OLD.verification_id) THEN
    RAISE EXCEPTION 'Verification ownership is immutable' USING ERRCODE='23514';
  END IF;
  SELECT status INTO owner_status FROM borrower_verifications WHERE id=NEW.verification_id AND workspace_id=NEW.workspace_id FOR UPDATE;
  IF owner_status IN ('COMPLETED','CANCELLED') THEN RAISE EXCEPTION 'Finalized verification is immutable' USING ERRCODE='23514'; END IF;
  IF TG_TABLE_NAME='borrower_verification_items' THEN
    IF TG_OP='UPDATE' AND (to_jsonb(NEW) - ARRAY['status','accepted_run_id','not_applicable_reason','updated_at']) IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['status','accepted_run_id','not_applicable_reason','updated_at']) THEN
      RAISE EXCEPTION 'Checklist definition is immutable' USING ERRCODE='23514';
    END IF;
    IF NEW.accepted_run_id IS NOT NULL AND (TG_OP='INSERT' OR NEW.accepted_run_id IS DISTINCT FROM OLD.accepted_run_id OR NEW.status='COMPLETED') THEN
      IF NOT EXISTS (
        SELECT 1 FROM borrower_check_runs r JOIN borrower_verifications v ON v.id=r.verification_id
        WHERE r.id=NEW.accepted_run_id AND r.item_id=NEW.id AND r.verification_id=NEW.verification_id AND r.workspace_id=NEW.workspace_id
          AND r.status='SUCCEEDED' AND r.identity_version_id=v.identity_version_id
          AND (r.valid_until IS NULL OR r.valid_until > CURRENT_TIMESTAMP)
      ) THEN RAISE EXCEPTION 'Accepted run must be successful, current and belong to this item' USING ERRCODE='23514'; END IF;
    END IF;
  ELSIF TG_TABLE_NAME='borrower_check_runs' THEN
    IF TG_OP='UPDATE' THEN
      IF (to_jsonb(NEW) - ARRAY['status','result_boolean','result_code','result_amount','currency','result_data','summary','risk_assessment','coverage','source_as_of_at','valid_until','error_code','error_message','reviewed_by_id','reviewed_at','started_at','finished_at','available_at','lease_owner','lease_expires_at','heartbeat_at']) IS DISTINCT FROM
         (to_jsonb(OLD) - ARRAY['status','result_boolean','result_code','result_amount','currency','result_data','summary','risk_assessment','coverage','source_as_of_at','valid_until','error_code','error_message','reviewed_by_id','reviewed_at','started_at','finished_at','available_at','lease_owner','lease_expires_at','heartbeat_at']) THEN
        RAISE EXCEPTION 'Run inputs and ownership are immutable' USING ERRCODE='23514';
      END IF;
      IF OLD.status IN ('SUCCEEDED','FAILED','CANCELLED') AND (to_jsonb(NEW) - ARRAY['reviewed_by_id','reviewed_at','risk_assessment']) IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['reviewed_by_id','reviewed_at','risk_assessment']) THEN
        RAISE EXCEPTION 'Terminal run facts are immutable' USING ERRCODE='23514';
      END IF;
    ELSE
      IF NEW.status NOT IN ('QUEUED','RUNNING') THEN RAISE EXCEPTION 'Run must start queued or running' USING ERRCODE='23514'; END IF;
      IF NOT EXISTS (SELECT 1 FROM borrower_verifications WHERE id=NEW.verification_id AND identity_version_id=NEW.identity_version_id) THEN
        RAISE EXCEPTION 'Run must use the confirmed identity attached to the verification' USING ERRCODE='23514';
      END IF;
    END IF;
    IF NEW.status='SUCCEEDED' THEN
      SELECT result_type INTO result_kind FROM borrower_verification_items WHERE id=NEW.item_id;
      IF (result_kind='BOOLEAN' AND NEW.result_boolean IS NULL) OR
         (result_kind='CATEGORY' AND NULLIF(btrim(NEW.result_code),'') IS NULL) OR
         (result_kind='MONEY' AND NEW.result_amount IS NULL) OR
         (result_kind='DOCUMENT' AND NOT EXISTS (SELECT 1 FROM borrower_verification_evidence WHERE verification_id=NEW.verification_id AND item_id=NEW.item_id AND document_id IS NOT NULL)) THEN
        RAISE EXCEPTION 'Successful run requires the configured result type or documentary evidence' USING ERRCODE='23514';
      END IF;
    END IF;
  ELSIF TG_TABLE_NAME='borrower_check_findings' THEN
    SELECT status INTO run_status FROM borrower_check_runs WHERE id=NEW.run_id;
    IF TG_OP='UPDATE' AND (NEW.run_id IS DISTINCT FROM OLD.run_id) THEN RAISE EXCEPTION 'Finding run is immutable' USING ERRCODE='23514'; END IF;
    IF run_status IN ('SUCCEEDED','FAILED','CANCELLED') AND (TG_OP='INSERT' OR
      (to_jsonb(NEW) - ARRAY['identity_match','match_basis','match_comment','match_reviewed_by_id','match_reviewed_at']) IS DISTINCT FROM
      (to_jsonb(OLD) - ARRAY['identity_match','match_basis','match_comment','match_reviewed_by_id','match_reviewed_at'])) THEN
      RAISE EXCEPTION 'Terminal run findings are immutable; only identity review may change' USING ERRCODE='23514';
    END IF;
  ELSIF TG_TABLE_NAME='borrower_verification_evidence' AND TG_OP='UPDATE' THEN
    IF (to_jsonb(NEW) - ARRAY['authenticity_status','ocr_status','ocr_engine_version','ocr_result','ocr_error','review_comment','reviewed_by_id','reviewed_at']) IS DISTINCT FROM
       (to_jsonb(OLD) - ARRAY['authenticity_status','ocr_status','ocr_engine_version','ocr_result','ocr_error','review_comment','reviewed_by_id','reviewed_at']) THEN
      RAISE EXCEPTION 'Evidence source and ownership are immutable; attach new evidence instead' USING ERRCODE='23514';
    END IF;
  ELSIF TG_TABLE_NAME='borrower_verification_risks' AND TG_OP='UPDATE' THEN
    IF (to_jsonb(NEW) - ARRAY['status','required_action','assigned_to_id','due_at','resolution_comment','resolution_evidence_id','resolved_by_id','resolved_at','updated_at']) IS DISTINCT FROM
       (to_jsonb(OLD) - ARRAY['status','required_action','assigned_to_id','due_at','resolution_comment','resolution_evidence_id','resolved_by_id','resolved_at','updated_at']) THEN
      RAISE EXCEPTION 'Risk basis is immutable; create a new assessment instead' USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER borrower_verification_items_guard BEFORE INSERT OR UPDATE OR DELETE ON borrower_verification_items FOR EACH ROW EXECUTE FUNCTION guard_verification_child();
CREATE TRIGGER borrower_check_runs_guard BEFORE INSERT OR UPDATE OR DELETE ON borrower_check_runs FOR EACH ROW EXECUTE FUNCTION guard_verification_child();
CREATE TRIGGER borrower_check_findings_guard BEFORE INSERT OR UPDATE OR DELETE ON borrower_check_findings FOR EACH ROW EXECUTE FUNCTION guard_verification_child();
CREATE TRIGGER borrower_verification_evidence_guard BEFORE INSERT OR UPDATE OR DELETE ON borrower_verification_evidence FOR EACH ROW EXECUTE FUNCTION guard_verification_child();
CREATE TRIGGER borrower_verification_risks_guard BEFORE INSERT OR UPDATE OR DELETE ON borrower_verification_risks FOR EACH ROW EXECUTE FUNCTION guard_verification_child();

CREATE FUNCTION guard_borrower_verification() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Verification history cannot be deleted' USING ERRCODE='23514'; END IF;
  IF TG_OP='INSERT' THEN
    IF NEW.status <> 'DRAFT' THEN RAISE EXCEPTION 'Verification must start as draft' USING ERRCODE='23514'; END IF;
    IF NOT EXISTS (SELECT 1 FROM parties WHERE id=NEW.party_id AND workspace_id=NEW.workspace_id AND kind IN ('PERSON','ENTREPRENEUR')) THEN
      RAISE EXCEPTION 'Verification requires a person or entrepreneur' USING ERRCODE='23514';
    END IF;
    RETURN NEW;
  END IF;
  IF OLD.status IN ('COMPLETED','CANCELLED') THEN RAISE EXCEPTION 'Finalized verification is immutable' USING ERRCODE='23514'; END IF;
  IF (to_jsonb(NEW) - ARRAY['identity_version_id','status','overall_risk','decision','decision_comment','decision_conditions','assigned_to_id','decided_by_id','decided_at','completed_at','valid_until','updated_at']) IS DISTINCT FROM
     (to_jsonb(OLD) - ARRAY['identity_version_id','status','overall_risk','decision','decision_comment','decision_conditions','assigned_to_id','decided_by_id','decided_at','completed_at','valid_until','updated_at']) THEN
    RAISE EXCEPTION 'Verification subject and checklist versions are immutable' USING ERRCODE='23514';
  END IF;
  IF NEW.identity_version_id IS DISTINCT FROM OLD.identity_version_id THEN
    UPDATE borrower_verification_items SET status='STALE', updated_at=CURRENT_TIMESTAMP WHERE verification_id=NEW.id AND accepted_run_id IS NOT NULL;
  END IF;
  IF NEW.status='COMPLETED' THEN
    IF NOT EXISTS (SELECT 1 FROM borrower_verification_items WHERE verification_id=NEW.id) OR EXISTS (
      SELECT 1 FROM borrower_verification_items i LEFT JOIN borrower_check_runs r ON r.id=i.accepted_run_id
      WHERE i.verification_id=NEW.id AND i.is_required AND (
        i.status NOT IN ('COMPLETED','NOT_APPLICABLE') OR (i.status='COMPLETED' AND (
          r.status IS DISTINCT FROM 'SUCCEEDED' OR r.identity_version_id IS DISTINCT FROM NEW.identity_version_id OR
          (r.valid_until IS NOT NULL AND r.valid_until <= CURRENT_TIMESTAMP))))
    ) OR EXISTS (SELECT 1 FROM borrower_check_runs WHERE verification_id=NEW.id AND status IN ('QUEUED','RUNNING')) THEN
      RAISE EXCEPTION 'Completion requires current mandatory results and no pending runs' USING ERRCODE='23514';
    END IF;
    IF NEW.overall_risk='NOT_ASSESSED' THEN RAISE EXCEPTION 'Completion requires a risk assessment' USING ERRCODE='23514'; END IF;
    IF NEW.decision='APPROVED' AND EXISTS (
      SELECT 1 FROM borrower_verification_risks k JOIN borrower_verification_items i ON i.id=k.item_id
      WHERE k.verification_id=NEW.id AND k.run_id=i.accepted_run_id AND k.status IN ('OPEN','IN_PROGRESS')
    ) THEN RAISE EXCEPTION 'Unconditional approval cannot have open risks in accepted results' USING ERRCODE='23514'; END IF;
  END IF;
  IF NEW.status='CANCELLED' AND EXISTS (SELECT 1 FROM borrower_check_runs WHERE verification_id=NEW.id AND status IN ('QUEUED','RUNNING')) THEN
    RAISE EXCEPTION 'Cancel pending runs before cancelling verification' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER borrower_verifications_guard BEFORE INSERT OR UPDATE OR DELETE ON borrower_verifications FOR EACH ROW EXECUTE FUNCTION guard_borrower_verification();

COMMIT;
