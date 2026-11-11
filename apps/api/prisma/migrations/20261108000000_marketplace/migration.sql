-- CreateTable
CREATE TABLE "marketplace_sources" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "channelUsername" TEXT,
    "contactUrl" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "parseImages" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "marketplace_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace_offers" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "externalMessageId" TEXT NOT NULL,
    "albumId" TEXT,
    "messageIds" JSONB NOT NULL DEFAULT '[]',
    "rawText" TEXT NOT NULL,
    "publicationUrl" TEXT,
    "publishedAt" TIMESTAMPTZ(3) NOT NULL,
    "revisionAt" TIMESTAMPTZ(3) NOT NULL,
    "receivedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "parseStatus" TEXT NOT NULL,
    "parseError" TEXT,
    "parserVersion" TEXT NOT NULL,
    "objectName" TEXT,
    "objectType" TEXT,
    "address" TEXT,
    "city" TEXT,
    "borrowerType" TEXT,
    "contactUrl" TEXT,
    "loanAmount" DECIMAL(20,2),
    "collateralValue" DECIMAL(20,2),
    "interestRateMonthly" DECIMAL(18,8),
    "loanTermMonths" DECIMAL(10,2),
    "ltv" DECIMAL(18,8),
    "monthlyIncome" DECIMAL(20,2),
    "totalIncome" DECIMAL(20,2),
    "declared" JSONB NOT NULL DEFAULT '{}',
    "calculated" JSONB NOT NULL DEFAULT '{}',
    "inferred" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "marketplace_offers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace_photos" (
    "id" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "externalMessageId" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "content" BYTEA NOT NULL,

    CONSTRAINT "marketplace_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace_marks" (
    "userId" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "saved" BOOLEAN NOT NULL DEFAULT false,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketplace_marks_pkey" PRIMARY KEY ("userId","offerId")
);

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_sources_key_key" ON "marketplace_sources"("key");

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_sources_channelId_key" ON "marketplace_sources"("channelId");

-- CreateIndex
CREATE INDEX "marketplace_offers_publishedAt_id_idx" ON "marketplace_offers"("publishedAt", "id");

-- CreateIndex
CREATE INDEX "marketplace_offers_city_objectType_idx" ON "marketplace_offers"("city", "objectType");

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_offers_sourceId_externalMessageId_key" ON "marketplace_offers"("sourceId", "externalMessageId");

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_offers_sourceId_albumId_key" ON "marketplace_offers"("sourceId", "albumId");

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_photos_offerId_externalMessageId_key" ON "marketplace_photos"("offerId", "externalMessageId");

-- AddForeignKey
ALTER TABLE "marketplace_offers" ADD CONSTRAINT "marketplace_offers_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "marketplace_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_photos" ADD CONSTRAINT "marketplace_photos_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "marketplace_offers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_marks" ADD CONSTRAINT "marketplace_marks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_marks" ADD CONSTRAINT "marketplace_marks_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "marketplace_offers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
