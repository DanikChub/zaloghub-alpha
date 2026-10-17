CREATE TYPE "DealStatus" AS ENUM ('DRAFT', 'ACTIVE', 'CLOSED');
CREATE TYPE "PaymentType" AS ENUM ('INTEREST', 'PRINCIPAL', 'PENALTY', 'OTHER');

CREATE TABLE "borrowers" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "firstName" TEXT NOT NULL,
  "lastName" TEXT NOT NULL,
  "middleName" TEXT,
  "phone" TEXT,
  "email" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "borrowers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "borrowers_userId_idx" ON "borrowers"("userId");

CREATE TABLE "collaterals" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "cadastralNumber" TEXT,
  "address" TEXT NOT NULL,
  "estimatedValue" DECIMAL(18,2),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "collaterals_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "collaterals_userId_idx" ON "collaterals"("userId");

CREATE TABLE "deals" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "borrowerId" TEXT,
  "collateralId" TEXT,
  "contractNumber" TEXT,
  "signedAt" TIMESTAMP(3),
  "contractCity" TEXT,
  "principalAmount" DECIMAL(18,2) NOT NULL,
  "preferentialRate" DECIMAL(8,4) NOT NULL,
  "standardRate" DECIMAL(8,4) NOT NULL,
  "moratoriumMonths" INTEGER NOT NULL,
  "termMonths" INTEGER NOT NULL,
  "penaltyRate" DECIMAL(8,4) NOT NULL,
  "increasedPenaltyRate" DECIMAL(8,4) NOT NULL,
  "paymentDay" INTEGER NOT NULL,
  "status" "DealStatus" NOT NULL DEFAULT 'DRAFT',
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "deals_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "deals_borrowerId_fkey" FOREIGN KEY ("borrowerId") REFERENCES "borrowers"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "deals_collateralId_fkey" FOREIGN KEY ("collateralId") REFERENCES "collaterals"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "deals_userId_deletedAt_idx" ON "deals"("userId","deletedAt");
CREATE INDEX "deals_borrowerId_idx" ON "deals"("borrowerId");
CREATE INDEX "deals_collateralId_idx" ON "deals"("collateralId");

CREATE TABLE "disbursements" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "dealId" TEXT NOT NULL,
  "amount" DECIMAL(18,2) NOT NULL,
  "issuedAt" TIMESTAMP(3) NOT NULL,
  "comment" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "disbursements_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "deals"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "disbursements_dealId_issuedAt_idx" ON "disbursements"("dealId","issuedAt");

CREATE TABLE "payments" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "dealId" TEXT NOT NULL,
  "amount" DECIMAL(18,2) NOT NULL,
  "type" "PaymentType" NOT NULL,
  "paidAt" TIMESTAMP(3) NOT NULL,
  "comment" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payments_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "deals"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "payments_dealId_paidAt_idx" ON "payments"("dealId","paidAt");
