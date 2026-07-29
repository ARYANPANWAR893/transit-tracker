import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const existing = await prisma.shipment.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Shipment not found" }, { status: 404 });
  }
  if (existing.status !== "ACCEPTED") {
    return NextResponse.json(
      { error: "Only accepted shipments can be marked arrived" },
      { status: 409 }
    );
  }

  const shipment = await prisma.shipment.update({
    where: { id },
    data: {
      status: "ARRIVED",
      finalArrivedDate: new Date(),
    },
  });

  return NextResponse.json(shipment);
}
