import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hasRole } from "@/lib/session";
import { serializeOrderDetail, ORDER_DETAIL_INCLUDE } from "@/lib/orderSerializer";
import { computeArrivalTotals, computeOrderStatus } from "@/lib/orders";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; arrivalId: string }> }
) {
  const user = await getCurrentUser();
  if (!hasRole(user, ["ADMIN", "EDITOR"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id, arrivalId } = await params;

  const order = await prisma.order.findUnique({
    where: { id },
    include: { arrivals: { select: { id: true, qty: true, arrivedDate: true } } },
  });
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
  if (!order.arrivals.some((a) => a.id === arrivalId)) {
    return NextResponse.json({ error: "Arrival not found on this order" }, { status: 404 });
  }

  await prisma.orderArrival.delete({ where: { id: arrivalId } });

  const remainingArrivals = order.arrivals.filter((a) => a.id !== arrivalId);
  const { qtyReceived } = computeArrivalTotals(order.qty, remainingArrivals);
  const status = computeOrderStatus(order.qty, qtyReceived, !!order.acceptanceDate);

  const updated = await prisma.order.update({
    where: { id },
    data: { status },
    include: ORDER_DETAIL_INCLUDE,
  });

  return NextResponse.json(serializeOrderDetail(updated));
}
