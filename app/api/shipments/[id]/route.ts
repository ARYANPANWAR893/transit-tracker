import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const EDITABLE_STRING_FIELDS = ["productName", "sku", "asin", "containerNumber"] as const;
const EDITABLE_DATE_FIELDS = [
  "requestedDate",
  "neededByDate",
  "acceptanceDate",
  "estArrivalDate",
  "finalArrivedDate",
] as const;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const data: Record<string, unknown> = {};

  for (const field of EDITABLE_STRING_FIELDS) {
    if (field in body) {
      if (typeof body[field] !== "string") {
        return NextResponse.json({ error: `Invalid ${field}` }, { status: 400 });
      }
      data[field] = body[field].trim() || null;
    }
  }

  for (const field of EDITABLE_DATE_FIELDS) {
    if (field in body) {
      if (body[field] === null) {
        data[field] = null;
      } else if (typeof body[field] === "string" && !Number.isNaN(Date.parse(body[field]))) {
        data[field] = new Date(body[field]);
      } else {
        return NextResponse.json({ error: `Invalid ${field}` }, { status: 400 });
      }
    }
  }

  if ("qty" in body) {
    if (typeof body.qty !== "number" || !Number.isFinite(body.qty) || body.qty <= 0) {
      return NextResponse.json({ error: "Invalid qty" }, { status: 400 });
    }
    data.qty = body.qty;
  }

  try {
    const shipment = await prisma.shipment.update({ where: { id }, data });
    return NextResponse.json(shipment);
  } catch {
    return NextResponse.json({ error: "Shipment not found" }, { status: 404 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    await prisma.shipment.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Shipment not found" }, { status: 404 });
  }
}
