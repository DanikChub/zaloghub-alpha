ALTER TABLE calendar_versions ADD COLUMN year INTEGER, ADD COLUMN source_url TEXT,
  ADD COLUMN imported_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE calendar_days ADD COLUMN kind TEXT;
CREATE TYPE "FinanceInstructionKind" AS ENUM ('REFUND','CREDIT','SETTLEMENT');
CREATE TYPE "FinanceInstructionStatus" AS ENUM ('AGREED','EXECUTED','CANCELLED');
CREATE TABLE finance_instructions (
  id TEXT PRIMARY KEY,
  "dealId" TEXT NOT NULL REFERENCES deals(id) ON DELETE RESTRICT,
  kind "FinanceInstructionKind" NOT NULL,
  status "FinanceInstructionStatus" NOT NULL DEFAULT 'AGREED',
  "effectiveOn" DATE NOT NULL,
  "executedOn" DATE,
  "executionReference" TEXT,
  "cancelledOn" DATE,
  payload JSONB NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "actorId" TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK ((status='AGREED' AND "executedOn" IS NULL AND "cancelledOn" IS NULL)
    OR (status='EXECUTED' AND "executedOn" IS NOT NULL AND "cancelledOn" IS NULL)
    OR (status='CANCELLED' AND "executedOn" IS NULL AND "cancelledOn" IS NOT NULL)),
  CHECK ("executedOn" IS NULL OR "executedOn">="effectiveOn")
);
CREATE UNIQUE INDEX "finance_instructions_dealId_idempotencyKey_key" ON finance_instructions("dealId","idempotencyKey");
CREATE INDEX "finance_instructions_dealId_effectiveOn_createdAt_idx" ON finance_instructions("dealId","effectiveOn","createdAt");
CREATE FUNCTION guard_finance_instruction() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Finance instructions cannot be deleted'; END IF;
  IF OLD.status<>'AGREED' OR NEW.id<>OLD.id OR NEW."dealId"<>OLD."dealId"
    OR NEW.kind<>OLD.kind OR NEW."effectiveOn"<>OLD."effectiveOn" OR NEW.payload<>OLD.payload
    OR NEW."actorId"<>OLD."actorId" OR NEW."idempotencyKey"<>OLD."idempotencyKey"
    OR NEW."createdAt"<>OLD."createdAt" OR NEW.status='AGREED' THEN
    RAISE EXCEPTION 'Only execution or cancellation of an agreed instruction is allowed';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER finance_instruction_history BEFORE UPDATE OR DELETE ON finance_instructions FOR EACH ROW EXECUTE FUNCTION guard_finance_instruction();
