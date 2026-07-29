import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { containerNumber, estArrivalDate } = await request.json();

  if (
    typeof containerNumber !== "string" ||
    !containerNumber.trim() ||
    typeof estArrivalDate !== "string" ||
    Number.isNaN(Date.parse(estArrivalDate))
  ) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const existing = await prisma.shipment.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Shipment not found" }, { status: 404 });
  }
  if (existing.status !== "REQUESTED") {
    return NextResponse.json(
      { error: "Only requested shipments can be accepted" },
      { status: 409 }
    );
  }

  const shipment = await prisma.shipment.update({
    where: { id },
    data: {
      status: "ACCEPTED",
      containerNumber: containerNumber.trim(),
      estArrivalDate: new Date(estArrivalDate),
      acceptanceDate: new Date(),
    },
  });

  return NextResponse.json(shipment);
}
