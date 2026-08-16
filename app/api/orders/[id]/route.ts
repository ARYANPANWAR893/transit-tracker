import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { canViewOrder, canAdminOverride } from "@/lib/permissions";
import { serializeOrderDetail, ORDER_DETAIL_INCLUDE } from "@/lib/orderSerializer";
import { logActivity } from "@/lib/activityLog";
import { deleteBlob } from "@/lib/blob";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const order = await prisma.order.findUnique({ where: { id }, include: ORDER_DETAIL_INCLUDE });
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  if (!canViewOrder(user, order)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  return NextResponse.json(serializeOrderDetail(order));
}

/** Admin-only direct edit / override — always logged with before/after values. */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!canAdminOverride(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await prisma.order.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  const body = await request.json();
  const data: Record<string, unknown> = {};
  const previousValue: Record<string, unknown> = {};
  const newValue: Record<string, unknown> = {};

  const numericFields = ["qty", "requestedPriceInr", "requestedPriceCny", "acceptedQty", "acceptedPriceCny", "acceptedPriceInr"] as const;
  for (const field of numericFields) {
    if (field in body) {
      if (typeof body[field] !== "number" || !Number.isFinite(body[field])) {
        return NextResponse.json({ error: `Invalid ${field}` }, { status: 400 });
      }
      data[field] = body[field];
      previousValue[field] = existing[field as keyof typeof existing];
      newValue[field] = body[field];
    }
  }

  const dateFields = ["neededByDate", "acceptedExpectedArrivalDate"] as const;
  for (const field of dateFields) {
    if (field in body) {
      if (body[field] === null) {
        data[field] = null;
      } else if (typeof body[field] === "string" && !Number.isNaN(Date.parse(body[field]))) {
        data[field] = new Date(body[field]);
      } else {
        return NextResponse.json({ error: `Invalid ${field}` }, { status: 400 });
      }
      previousValue[field] = existing[field as keyof typeof existing];
      newValue[field] = data[field];
    }
  }

  if ("status" in body) {
    const validStatuses = [
      "DRAFT", "REQUESTED", "ACCEPTED", "REJECTED", "WITHDRAWN", "IN_TRANSIT", "ARRIVED", "CONFIRMED_RECEIVED",
    ];
    if (typeof body.status !== "string" || !validStatuses.includes(body.status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    data.status = body.status;
    previousValue.status = existing.status;
    newValue.status = body.status;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const order = await prisma.order.update({ where: { id }, data, include: ORDER_DETAIL_INCLUDE });

  await logActivity({
    actor: user,
    action: "ADMIN_OVERRIDE",
    entityType: "Order",
    entityId: id,
    previousValue,
    newValue,
    remarks: typeof body.remarks === "string" ? body.remarks : null,
  });

  return NextResponse.json(serializeOrderDetail(order));
}

/** Admin-only hard delete — an operational cleanup tool, not part of the normal lifecycle. */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!canAdminOverride(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const order = await prisma.order.findUnique({ where: { id }, include: { photos: true } });
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  await prisma.order.delete({ where: { id } });
  await Promise.allSettled(order.photos.map((photo) => deleteBlob(photo.url)));

  await logActivity({
    actor: user,
    action: "ORDER_DELETED",
    entityType: "Order",
    entityId: id,
    previousValue: { status: order.status, qty: order.qty },
  });

  return NextResponse.json({ ok: true });
}
