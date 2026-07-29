/*
  Warnings:

  - Added the required column `neededByDate` to the `Shipment` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Shipment" ADD COLUMN     "neededByDate" TIMESTAMP(3) NOT NULL;
