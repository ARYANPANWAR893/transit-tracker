import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hasRole } from "@/lib/session";
import { serializeOrderDetail, ORDER_DETAIL_INCLUDE } from "@/lib/orderSerializer";
import { computeArrivalTotals, computeOrderStatus } from "@/lib/orders";
import { deleteBlob } from "@/lib/blob";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const order = await prisma.order.findUnique({ where: { id }, include: ORDER_DETAIL_INCLUDE });
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
  return NextResponse.json(serializeOrderDetail(order));
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!hasRole(user, ["ADMIN", "EDITOR"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const data: Record<string, unknown> = {};

  if ("qty" in body) {
    if (typeof body.qty !== "number" || !Number.isFinite(body.qty) || body.qty <= 0) {
      return NextResponse.json({ error: "Invalid qty" }, { status: 400 });
    }
    data.qty = body.qty;
  }
  if ("containerNumber" in body) {
    data.containerNumber = typeof body.containerNumber === "string" ? body.containerNumber.trim() || null : null;
  }
  for (const field of ["neededByDate", "estArrivalDate"] as const) {
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

  const existing = await prisma.order.findUnique({
    where: { id },
    include: { arrivals: { select: { qty: true, arrivedDate: true } } },
  });
  if (!existing) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const effectiveQty = (data.qty as number | undefined) ?? existing.qty;
  const { qtyReceived } = computeArrivalTotals(effectiveQty, existing.arrivals);
  data.status = computeOrderStatus(effectiveQty, qtyReceived, !!existing.acceptanceDate);

  const order = await prisma.order.update({ where: { id }, data, include: ORDER_DETAIL_INCLUDE });
  return NextResponse.json(serializeOrderDetail(order));
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!hasRole(user, ["ADMIN", "EDITOR"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const order = await prisma.order.findUnique({ where: { id }, include: { photos: true } });
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  await prisma.order.delete({ where: { id } });

  await Promise.allSettled(order.photos.map((photo) => deleteBlob(photo.url)));

  return NextResponse.json({ ok: true });
}
