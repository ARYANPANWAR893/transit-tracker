-- Sourcing Control Tower
-- Reshapes the linear Order lifecycle into Requirement -> Procurement -> Allocation
-- -> Container -> Receipt, moves product identifiers into their own table, and
-- removes pricing entirely. Written by hand so existing rows survive as history
-- rather than being dropped.

-- ---------------------------------------------------------------- 1. ENUMS

CREATE TYPE "Role_new" AS ENUM ('ADMIN','REQUIREMENT_OWNER','PROCUREMENT_OWNER','SOURCING_COORDINATOR','LOADING_COORDINATOR');
ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "role" TYPE "Role_new" USING (
  CASE "role"::text
    WHEN 'ORDERER'         THEN 'REQUIREMENT_OWNER'
    WHEN 'ORDER_ACCEPTER'  THEN 'SOURCING_COORDINATOR'
    ELSE 'ADMIN'
  END
)::"Role_new";
ALTER TABLE "ActivityLog" ALTER COLUMN "actorRole" TYPE "Role_new" USING (
  CASE "actorRole"::text
    WHEN 'ORDERER'        THEN 'REQUIREMENT_OWNER'
    WHEN 'ORDER_ACCEPTER' THEN 'SOURCING_COORDINATOR'
    WHEN 'ADMIN'          THEN 'ADMIN'
    ELSE NULL
  END
)::"Role_new";
DROP TYPE "Role";
ALTER TYPE "Role_new" RENAME TO "Role";
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'REQUIREMENT_OWNER';

CREATE TYPE "RequirementStatus" AS ENUM ('REQUESTED','REJECTED','WITHDRAWN');
CREATE TYPE "ContainerStatus" AS ENUM ('CREATED','PROCUREMENT','READY_FOR_LOADING','LOADING','LOADED','IN_TRANSIT','ARRIVED');
CREATE TYPE "IdentifierType" AS ENUM ('KMW','KATTYMAO_SKU','MA_SKU','CHINA_CODE','AMAZON_SKU','AMAZON_ASIN','FLIPKART_SKU','FLIPKART_ASIN','MEESHO_SKU','MEESHO_PRODUCT_ID');

CREATE TYPE "PhotoSource_new" AS ENUM ('REQUIREMENT_UPLOAD','CONTAINER_IMPORT');
ALTER TABLE "Photo" ALTER COLUMN "source" DROP DEFAULT;
ALTER TABLE "Photo" ALTER COLUMN "source" TYPE "PhotoSource_new" USING (
  CASE "source"::text WHEN 'CONTAINER_IMPORT' THEN 'CONTAINER_IMPORT' ELSE 'REQUIREMENT_UPLOAD' END
)::"PhotoSource_new";
DROP TYPE "PhotoSource";
ALTER TYPE "PhotoSource_new" RENAME TO "PhotoSource";
ALTER TABLE "Photo" ALTER COLUMN "source" SET DEFAULT 'REQUIREMENT_UPLOAD';

-- ------------------------------------------------- 2. PRODUCT IDENTIFIERS

CREATE TABLE "ProductIdentifier" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "type" "IdentifierType" NOT NULL,
    "value" TEXT NOT NULL,
    "normalizedValue" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProductIdentifier_pkey" PRIMARY KEY ("id")
);

-- Backfill from the eight fixed columns BEFORE dropping them. Values are split on
-- commas because the ERP export packs multiple codes into one cell.
INSERT INTO "ProductIdentifier" ("id","productId","type","value","normalizedValue","createdAt")
SELECT gen_random_uuid()::text, p.id, t.type::"IdentifierType", TRIM(v.value),
       UPPER(REGEXP_REPLACE(TRIM(v.value), '[^A-Za-z0-9]', '', 'g')),
       now()
FROM "Product" p
CROSS JOIN LATERAL (VALUES
  ('KMW',               p."kmwId"),
  ('MA_SKU',            p."maSku"),
  ('AMAZON_SKU',        p."amazonSku"),
  ('AMAZON_ASIN',       p."amazonAsin"),
  ('FLIPKART_SKU',      p."flipkartSku"),
  ('FLIPKART_ASIN',     p."flipkartAsin"),
  ('MEESHO_SKU',        p."meeshoSku"),
  ('MEESHO_PRODUCT_ID', p."meeshoProductId")
) AS t(type, raw)
CROSS JOIN LATERAL UNNEST(STRING_TO_ARRAY(COALESCE(t.raw,''), ',')) AS v(value)
WHERE TRIM(v.value) <> ''
  AND UPPER(REGEXP_REPLACE(TRIM(v.value), '[^A-Za-z0-9]', '', 'g')) <> ''
ON CONFLICT DO NOTHING;

CREATE UNIQUE INDEX "ProductIdentifier_productId_type_value_key" ON "ProductIdentifier"("productId","type","value");
CREATE INDEX "ProductIdentifier_normalizedValue_idx" ON "ProductIdentifier"("normalizedValue");
CREATE INDEX "ProductIdentifier_productId_idx" ON "ProductIdentifier"("productId");
ALTER TABLE "ProductIdentifier" ADD CONSTRAINT "ProductIdentifier_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DROP INDEX IF EXISTS "Product_maSku_key";
DROP INDEX IF EXISTS "Product_kmwId_key";
ALTER TABLE "Product"
  DROP COLUMN "amazonSku", DROP COLUMN "amazonAsin",
  DROP COLUMN "flipkartSku", DROP COLUMN "flipkartAsin",
  DROP COLUMN "meeshoSku", DROP COLUMN "meeshoProductId",
  DROP COLUMN "maSku", DROP COLUMN "kmwId";

-- --------------------------------------------------------- 3. CONTAINERS

CREATE TABLE "Container" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "loadingDate" TIMESTAMP(3),
    "expectedArrivalDate" TIMESTAMP(3),
    "status" "ContainerStatus" NOT NULL DEFAULT 'CREATED',
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Container_pkey" PRIMARY KEY ("id")
);

-- Promote the free-text containerName on past uploads into real Container rows.
INSERT INTO "Container" ("id","code","status","createdById","createdAt","updatedAt")
SELECT gen_random_uuid()::text,
       UPPER(REGEXP_REPLACE(cu."containerName", '[^A-Za-z0-9]', '', 'g')),
       'ARRIVED', cu."uploadedById", MIN(cu."createdAt"), now()
FROM "ContainerUpload" cu
WHERE COALESCE(UPPER(REGEXP_REPLACE(cu."containerName", '[^A-Za-z0-9]', '', 'g')), '') <> ''
GROUP BY 2, cu."uploadedById";

CREATE UNIQUE INDEX "Container_code_key" ON "Container"("code");
CREATE INDEX "Container_status_idx" ON "Container"("status");
ALTER TABLE "Container" ADD CONSTRAINT "Container_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ContainerUpload" ADD COLUMN "containerId" TEXT;
UPDATE "ContainerUpload" cu SET "containerId" = c.id
FROM "Container" c
WHERE c.code = UPPER(REGEXP_REPLACE(cu."containerName", '[^A-Za-z0-9]', '', 'g'));
DELETE FROM "ContainerUpload" WHERE "containerId" IS NULL;
ALTER TABLE "ContainerUpload" ALTER COLUMN "containerId" SET NOT NULL;
ALTER TABLE "ContainerUpload" DROP COLUMN "containerName";
CREATE INDEX "ContainerUpload_containerId_idx" ON "ContainerUpload"("containerId");
ALTER TABLE "ContainerUpload" ADD CONSTRAINT "ContainerUpload_containerId_fkey"
  FOREIGN KEY ("containerId") REFERENCES "Container"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ------------------------------------- 4. REQUIREMENT (renamed from Order)

ALTER TABLE "Order" RENAME TO "Requirement";
ALTER TABLE "Requirement" RENAME COLUMN "qty" TO "requiredQty";

ALTER TABLE "Requirement" ADD COLUMN "status_new" "RequirementStatus" NOT NULL DEFAULT 'REQUESTED';
UPDATE "Requirement" SET "status_new" = (
  CASE "status"::text
    WHEN 'REJECTED'  THEN 'REJECTED'
    WHEN 'WITHDRAWN' THEN 'WITHDRAWN'
    ELSE 'REQUESTED'   -- ACCEPTED and beyond are now derived from quantities
  END
)::"RequirementStatus";
ALTER TABLE "Requirement" DROP COLUMN "status";
ALTER TABLE "Requirement" RENAME COLUMN "status_new" TO "status";

-- --------------------------------- 5. PROCUREMENT / ALLOCATION / RECEIPT

CREATE TABLE "Procurement" (
    "id" TEXT NOT NULL,
    "requirementId" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "confirmedById" TEXT NOT NULL,
    "confirmedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    CONSTRAINT "Procurement_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Allocation" (
    "id" TEXT NOT NULL,
    "requirementId" TEXT NOT NULL,
    "containerId" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "allocatedById" TEXT NOT NULL,
    "allocatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Allocation_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Receipt" (
    "id" TEXT NOT NULL,
    "allocationId" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "confirmedById" TEXT NOT NULL,
    "confirmedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Receipt_pkey" PRIMARY KEY ("id")
);

-- An accepted quantity was a procurement commitment: carry it across.
INSERT INTO "Procurement" ("id","requirementId","qty","confirmedById","confirmedAt","notes")
SELECT gen_random_uuid()::text, r.id, r."acceptedQty",
       COALESCE(r."acceptedById", r."createdById"),
       COALESCE(r."acceptanceDate", r."createdAt"),
       'Carried over from the accepted quantity on the previous order model'
FROM "Requirement" r
WHERE r."acceptedQty" IS NOT NULL AND r."acceptedQty" > 0;

-- Orders that reached a container become allocations against it.
INSERT INTO "Allocation" ("id","requirementId","containerId","qty","allocatedById","allocatedAt")
SELECT DISTINCT ON (r.id) gen_random_uuid()::text, r.id, cu."containerId",
       COALESCE(r."acceptedQty", r."requiredQty"),
       COALESCE(r."acceptedById", r."createdById"),
       COALESCE(r."acceptanceDate", r."createdAt")
FROM "Requirement" r
JOIN "ContainerItem" ci ON ci."matchedOrderId" = r.id
JOIN "ContainerUpload" cu ON cu.id = ci."containerUploadId"
ORDER BY r.id, ci."createdAt";

-- Confirmed receipts become Receipt rows against those allocations.
INSERT INTO "Receipt" ("id","allocationId","qty","confirmedById","confirmedAt")
SELECT gen_random_uuid()::text, a.id, a.qty,
       COALESCE(r."confirmedById", r."createdById"), r."confirmedReceivedAt"
FROM "Allocation" a
JOIN "Requirement" r ON r.id = a."requirementId"
WHERE r."confirmedReceivedAt" IS NOT NULL;

CREATE INDEX "Procurement_requirementId_idx" ON "Procurement"("requirementId");
CREATE INDEX "Allocation_requirementId_idx" ON "Allocation"("requirementId");
CREATE INDEX "Allocation_containerId_idx" ON "Allocation"("containerId");
CREATE INDEX "Receipt_allocationId_idx" ON "Receipt"("allocationId");
ALTER TABLE "Procurement" ADD CONSTRAINT "Procurement_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "Requirement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Procurement" ADD CONSTRAINT "Procurement_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Allocation" ADD CONSTRAINT "Allocation_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "Requirement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Allocation" ADD CONSTRAINT "Allocation_containerId_fkey" FOREIGN KEY ("containerId") REFERENCES "Container"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Allocation" ADD CONSTRAINT "Allocation_allocatedById_fkey" FOREIGN KEY ("allocatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_allocationId_fkey" FOREIGN KEY ("allocationId") REFERENCES "Allocation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Now that the lifecycle lives in its own tables, drop the inline columns + pricing.
ALTER TABLE "Requirement"
  DROP COLUMN "requestedPriceInr", DROP COLUMN "requestedPriceCny",
  DROP COLUMN "acceptedQty", DROP COLUMN "acceptedPriceCny", DROP COLUMN "acceptedPriceInr",
  DROP COLUMN "acceptedExpectedArrivalDate", DROP COLUMN "acceptanceDate", DROP COLUMN "acceptedById",
  DROP COLUMN "arrivedAt", DROP COLUMN "arrivedById",
  DROP COLUMN "confirmedReceivedAt", DROP COLUMN "confirmedById";

DROP TABLE "CurrencyConversion";
DROP TYPE "ConversionKind";
DROP TYPE "OrderStatus";

-- ------------------------------------------- 6. RE-POINT CHILD RELATIONS

ALTER TABLE "Remark" RENAME COLUMN "orderId" TO "requirementId";
ALTER TABLE "Photo"  RENAME COLUMN "orderId" TO "requirementId";

ALTER TABLE "ContainerItem" ADD COLUMN "containerId" TEXT;
UPDATE "ContainerItem" ci SET "containerId" = cu."containerId"
FROM "ContainerUpload" cu WHERE cu.id = ci."containerUploadId";
DELETE FROM "ContainerItem" WHERE "containerId" IS NULL;
ALTER TABLE "ContainerItem" ALTER COLUMN "containerId" SET NOT NULL;
ALTER TABLE "ContainerItem" ALTER COLUMN "containerUploadId" DROP NOT NULL;

-- Manifest rows now resolve to a Product, not to an order.
ALTER TABLE "ContainerItem" ADD COLUMN "resolvedProductId" TEXT;
UPDATE "ContainerItem" ci SET "resolvedProductId" = r."productId"
FROM "Requirement" r WHERE r.id = ci."matchedOrderId";
ALTER TABLE "ContainerItem" DROP COLUMN "matchedOrderId";

CREATE INDEX "ContainerItem_containerId_idx" ON "ContainerItem"("containerId");
CREATE INDEX "ContainerItem_resolvedProductId_idx" ON "ContainerItem"("resolvedProductId");
ALTER TABLE "ContainerItem" ADD CONSTRAINT "ContainerItem_containerId_fkey" FOREIGN KEY ("containerId") REFERENCES "Container"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContainerItem" ADD CONSTRAINT "ContainerItem_resolvedProductId_fkey" FOREIGN KEY ("resolvedProductId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ContainerItem" DROP CONSTRAINT IF EXISTS "ContainerItem_containerUploadId_fkey";
ALTER TABLE "ContainerItem" ADD CONSTRAINT "ContainerItem_containerUploadId_fkey" FOREIGN KEY ("containerUploadId") REFERENCES "ContainerUpload"("id") ON DELETE SET NULL ON UPDATE CASCADE;
