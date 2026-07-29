import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ShipmentStatus } from "@/app/generated/prisma/client";

export async function GET(request: NextRequest) {
  const status = request.nextUrl.searchParams.get("status");

  const where =
    status && status in ShipmentStatus
      ? { status: status as ShipmentStatus }
      : {};

  const shipments = await prisma.shipment.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(shipments);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { productName, sku, asin, qty, neededByDate } = body;

  if (
    typeof productName !== "string" ||
    !productName.trim() ||
    typeof sku !== "string" ||
    !sku.trim() ||
    typeof asin !== "string" ||
    !asin.trim() ||
    typeof qty !== "number" ||
    !Number.isFinite(qty) ||
    qty <= 0 ||
    typeof neededByDate !== "string" ||
    Number.isNaN(Date.parse(neededByDate))
  ) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const shipment = await prisma.shipment.create({
    data: {
      productName: productName.trim(),
      sku: sku.trim(),
      asin: asin.trim(),
      qty,
      requestedDate: new Date(),
      neededByDate: new Date(neededByDate),
      status: "REQUESTED",
    },
  });

  return NextResponse.json(shipment, { status: 201 });
}
