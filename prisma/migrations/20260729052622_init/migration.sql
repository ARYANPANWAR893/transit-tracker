-- CreateEnum
CREATE TYPE "ShipmentStatus" AS ENUM ('REQUESTED', 'ACCEPTED', 'ARRIVED');

-- CreateTable
CREATE TABLE "Shipment" (
    "id" TEXT NOT NULL,
    "status" "ShipmentStatus" NOT NULL DEFAULT 'REQUESTED',
    "productName" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "asin" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "requestedDate" TIMESTAMP(3) NOT NULL,
    "acceptanceDate" TIMESTAMP(3),
    "containerNumber" TEXT,
    "estArrivalDate" TIMESTAMP(3),
    "finalArrivedDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shipment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Shipment_status_idx" ON "Shipment"("status");
