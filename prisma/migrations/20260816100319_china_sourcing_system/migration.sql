-- Hand-written migration (not a raw Prisma auto-diff) so that real production
-- data survives: 4 real users (role remap), 1 real order (status remap +
-- price backfill), 1 real product (kmSku -> kmwId data preserved), and the
-- one legacy OrderArrival record (folded into ActivityLog before its table
-- is dropped, since the new schema has no per-arrival-batch concept).

-- ============ New enums ============
CREATE TYPE "ConversionKind" AS ENUM ('REQUEST', 'ACCEPTANCE');
CREATE TYPE "ContainerUploadStatus" AS ENUM ('PROCESSING', 'COMPLETED', 'FAILED');
CREATE TYPE "ContainerItemMatchStatus" AS ENUM ('MATCHED', 'AMBIGUOUS', 'UNMATCHED', 'ERROR');
CREATE TYPE "PhotoSource" AS ENUM ('ORDERER_UPLOAD', 'CONTAINER_IMPORT');

-- ============ OrderStatus: remap old values, don't just cast ============
-- old REQUESTED/ACCEPTED pass through unchanged; PARTIALLY_ARRIVED -> IN_TRANSIT
-- (still coming); old ARRIVED meant "fully received" -> CONFIRMED_RECEIVED.
BEGIN;
CREATE TYPE "OrderStatus_new" AS ENUM ('DRAFT', 'REQUESTED', 'ACCEPTED', 'REJECTED', 'WITHDRAWN', 'IN_TRANSIT', 'ARRIVED', 'CONFIRMED_RECEIVED');
ALTER TABLE "Order" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Order" ALTER COLUMN "status" TYPE "OrderStatus_new" USING (
  CASE "status"::text
    WHEN 'PARTIALLY_ARRIVED' THEN 'IN_TRANSIT'
    WHEN 'ARRIVED' THEN 'CONFIRMED_RECEIVED'
    ELSE "status"::text
  END
)::"OrderStatus_new";
DROP TYPE "OrderStatus";
ALTER TYPE "OrderStatus_new" RENAME TO "OrderStatus";
ALTER TABLE "Order" ALTER COLUMN "status" SET DEFAULT 'REQUESTED';
COMMIT;

-- ============ Role: remap old values, don't just cast ============
-- EDITOR -> ADMIN, VIEWER -> ORDERER (per explicit real-user mapping decided
-- for the 4 production accounts: Aryan stays ADMIN, Sachin EDITOR->ADMIN,
-- Ruhi/Ashish VIEWER->ORDERER).
BEGIN;
CREATE TYPE "Role_new" AS ENUM ('ADMIN', 'ORDERER', 'ORDER_ACCEPTER');
ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "role" TYPE "Role_new" USING (
  CASE "role"::text
    WHEN 'EDITOR' THEN 'ADMIN'
    WHEN 'VIEWER' THEN 'ORDERER'
    ELSE "role"::text
  END
)::"Role_new";
DROP TYPE "Role";
ALTER TYPE "Role_new" RENAME TO "Role";
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'ORDERER';
COMMIT;

-- ============ New tables (created before OrderArrival is dropped, so its
-- history can be folded into ActivityLog) ============
CREATE TABLE "CurrencyConversion" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "kind" "ConversionKind" NOT NULL,
    "originalAmount" DECIMAL(14,2) NOT NULL,
    "originalCurrency" TEXT NOT NULL,
    "convertedAmount" DECIMAL(14,2) NOT NULL,
    "convertedCurrency" TEXT NOT NULL,
    "rate" DECIMAL(18,8) NOT NULL,
    "rateTimestamp" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CurrencyConversion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ContainerUpload" (
    "id" TEXT NOT NULL,
    "containerName" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "blobUrl" TEXT NOT NULL,
    "status" "ContainerUploadStatus" NOT NULL DEFAULT 'PROCESSING',
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "matchedCount" INTEGER NOT NULL DEFAULT 0,
    "ambiguousCount" INTEGER NOT NULL DEFAULT 0,
    "unmatchedCount" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "uploadedById" TEXT NOT NULL,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ContainerUpload_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ContainerItem" (
    "id" TEXT NOT NULL,
    "containerUploadId" TEXT NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "shippingMark" TEXT,
    "itemNo" TEXT,
    "description" TEXT,
    "sectionLabel" TEXT,
    "cartons" INTEGER,
    "qtyPerCarton" INTEGER,
    "totalQty" INTEGER,
    "cbm" DECIMAL(12,4),
    "totalCbm" DECIMAL(12,4),
    "weight" DECIMAL(12,4),
    "totalWeight" DECIMAL(12,4),
    "imageUrl" TEXT,
    "matchStatus" "ContainerItemMatchStatus" NOT NULL,
    "matchNote" TEXT,
    "matchedOrderId" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ContainerItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "actorRole" "Role",
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "previousValue" JSONB,
    "newValue" JSONB,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- ============ Fold legacy OrderArrival history into ActivityLog, then drop it ============
INSERT INTO "ActivityLog" ("id", "actorId", "actorRole", "action", "entityType", "entityId", "newValue", "remarks", "createdAt")
SELECT
  'mig_' || oa."id",
  oa."recordedById",
  u."role",
  'LEGACY_ARRIVAL_RECORD',
  'Order',
  oa."orderId",
  jsonb_build_object('qty', oa."qty", 'arrivedDate', oa."arrivedDate", 'containerNumber', oa."containerNumber"),
  'Migrated from the pre-China-sourcing OrderArrival table during schema migration',
  oa."createdAt"
FROM "OrderArrival" oa
JOIN "User" u ON u."id" = oa."recordedById";

ALTER TABLE "OrderArrival" DROP CONSTRAINT "OrderArrival_orderId_fkey";
ALTER TABLE "OrderArrival" DROP CONSTRAINT "OrderArrival_recordedById_fkey";
DROP TABLE "OrderArrival";

-- ============ Product: preserve kmSku data under its new name ============
ALTER TABLE "Product" ADD COLUMN "kmwId" TEXT;
ALTER TABLE "Product" ADD COLUMN "amazonSku" TEXT;
ALTER TABLE "Product" ADD COLUMN "amazonAsin" TEXT;
ALTER TABLE "Product" ADD COLUMN "flipkartSku" TEXT;
ALTER TABLE "Product" ADD COLUMN "flipkartAsin" TEXT;
UPDATE "Product" SET "kmwId" = "kmSku" WHERE "kmSku" IS NOT NULL;
DROP INDEX "Product_kmSku_key";
ALTER TABLE "Product" DROP COLUMN "kmSku";
ALTER TABLE "Product" ALTER COLUMN "maSku" DROP NOT NULL;
CREATE UNIQUE INDEX "Product_kmwId_key" ON "Product"("kmwId");

-- ============ Order: drop superseded free-text fields, add lifecycle fields ============
ALTER TABLE "Order" DROP COLUMN "containerNumber";
ALTER TABLE "Order" DROP COLUMN "estArrivalDate";
ALTER TABLE "Order" ADD COLUMN "acceptedById" TEXT;
ALTER TABLE "Order" ADD COLUMN "acceptedExpectedArrivalDate" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN "acceptedPriceCny" DECIMAL(14,2);
ALTER TABLE "Order" ADD COLUMN "acceptedPriceInr" DECIMAL(14,2);
ALTER TABLE "Order" ADD COLUMN "acceptedQty" INTEGER;
ALTER TABLE "Order" ADD COLUMN "arrivedAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN "arrivedById" TEXT;
ALTER TABLE "Order" ADD COLUMN "confirmedById" TEXT;
ALTER TABLE "Order" ADD COLUMN "confirmedReceivedAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN "rejectedAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN "rejectedById" TEXT;
ALTER TABLE "Order" ADD COLUMN "rejectionReason" TEXT;
ALTER TABLE "Order" ADD COLUMN "requestedPriceCny" DECIMAL(14,2);
ALTER TABLE "Order" ADD COLUMN "withdrawnAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN "withdrawnById" TEXT;
-- requestedPriceInr is genuinely required going forward, but the 1 existing
-- order predates price tracking entirely -- backfill 0 (flagged for Admin
-- correction) rather than fail the migration, then enforce NOT NULL for
-- everything from here on.
ALTER TABLE "Order" ADD COLUMN "requestedPriceInr" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "Order" ALTER COLUMN "requestedPriceInr" DROP DEFAULT;

-- ============ Photo: tag source (existing rows default to orderer upload) ============
ALTER TABLE "Photo" ADD COLUMN "source" "PhotoSource" NOT NULL DEFAULT 'ORDERER_UPLOAD';

-- ============ Indexes ============
CREATE INDEX "CurrencyConversion_orderId_idx" ON "CurrencyConversion"("orderId");
CREATE INDEX "ContainerUpload_uploadedById_idx" ON "ContainerUpload"("uploadedById");
CREATE INDEX "ContainerItem_containerUploadId_idx" ON "ContainerItem"("containerUploadId");
CREATE INDEX "ContainerItem_matchedOrderId_idx" ON "ContainerItem"("matchedOrderId");
CREATE INDEX "ContainerItem_matchStatus_idx" ON "ContainerItem"("matchStatus");
CREATE INDEX "ActivityLog_entityType_entityId_idx" ON "ActivityLog"("entityType", "entityId");
CREATE INDEX "ActivityLog_actorId_idx" ON "ActivityLog"("actorId");
CREATE INDEX "ActivityLog_createdAt_idx" ON "ActivityLog"("createdAt");
CREATE INDEX "Order_createdById_idx" ON "Order"("createdById");

-- ============ Foreign keys ============
ALTER TABLE "Order" ADD CONSTRAINT "Order_acceptedById_fkey" FOREIGN KEY ("acceptedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_rejectedById_fkey" FOREIGN KEY ("rejectedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_withdrawnById_fkey" FOREIGN KEY ("withdrawnById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_arrivedById_fkey" FOREIGN KEY ("arrivedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CurrencyConversion" ADD CONSTRAINT "CurrencyConversion_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContainerUpload" ADD CONSTRAINT "ContainerUpload_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ContainerItem" ADD CONSTRAINT "ContainerItem_containerUploadId_fkey" FOREIGN KEY ("containerUploadId") REFERENCES "ContainerUpload"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContainerItem" ADD CONSTRAINT "ContainerItem_matchedOrderId_fkey" FOREIGN KEY ("matchedOrderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ContainerItem" ADD CONSTRAINT "ContainerItem_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
