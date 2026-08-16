import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { canActOnFulfillment } from "@/lib/permissions";
import { serializeOrderDetail, ORDER_DETAIL_INCLUDE } from "@/lib/orderSerializer";
import { logActivity } from "@/lib/activityLog";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!canActOnFulfillment(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const { reason } = await request.json();

  if (typeof reason !== "string" || !reason.trim()) {
    return NextResponse.json({ error: "A rejection reason is required" }, { status: 400 });
  }

  const existing = await prisma.order.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  if (existing.status !== "REQUESTED") {
    return NextResponse.json({ error: "Only requested orders can be rejected" }, { status: 409 });
  }

  const order = await prisma.order.update({
    where: { id },
    data: {
      status: "REJECTED",
      rejectionReason: reason.trim(),
      rejectedAt: new Date(),
      rejectedById: user!.id,
    },
    include: ORDER_DETAIL_INCLUDE,
  });

  await logActivity({
    actor: user,
    action: "ORDER_REJECTED",
    entityType: "Order",
    entityId: id,
    previousValue: { status: existing.status },
    newValue: { status: "REJECTED" },
    remarks: reason.trim(),
  });

  return NextResponse.json(serializeOrderDetail(order));
}
