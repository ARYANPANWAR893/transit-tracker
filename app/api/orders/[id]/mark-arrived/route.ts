import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { canActOnFulfillment } from "@/lib/permissions";
import { serializeOrderDetail, ORDER_DETAIL_INCLUDE } from "@/lib/orderSerializer";
import { logActivity } from "@/lib/activityLog";

/** Order Accepter / Admin marks an in-transit order as physically arrived, which
 * surfaces the "has it arrived?" prompt to the Orderer. */
export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!canActOnFulfillment(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await prisma.order.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  if (existing.status !== "IN_TRANSIT") {
    return NextResponse.json({ error: "Only in-transit orders can be marked arrived" }, { status: 409 });
  }

  const order = await prisma.order.update({
    where: { id },
    data: { status: "ARRIVED", arrivedAt: new Date(), arrivedById: user!.id },
    include: ORDER_DETAIL_INCLUDE,
  });

  await logActivity({
    actor: user,
    action: "ORDER_MARKED_ARRIVED",
    entityType: "Order",
    entityId: id,
    previousValue: { status: existing.status },
    newValue: { status: "ARRIVED" },
  });

  return NextResponse.json(serializeOrderDetail(order));
}
