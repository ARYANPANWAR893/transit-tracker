import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hasRole } from "@/lib/session";
import { serializeOrderDetail, ORDER_DETAIL_INCLUDE } from "@/lib/orderSerializer";
import { computeArrivalTotals, computeOrderStatus } from "@/lib/orders";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!hasRole(user, ["ADMIN", "EDITOR"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const { qty, arrivedDate, containerNumber } = await request.json();

  if (
    typeof qty !== "number" ||
    !Number.isFinite(qty) ||
    qty <= 0 ||
    typeof arrivedDate !== "string" ||
    Number.isNaN(Date.parse(arrivedDate))
  ) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const order = await prisma.order.findUnique({
    where: { id },
    include: { arrivals: { select: { qty: true, arrivedDate: true } } },
  });
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
  if (order.status === "REQUESTED") {
    return NextResponse.json({ error: "Accept the order before recording arrivals" }, { status: 409 });
  }
  if (order.status === "ARRIVED") {
    return NextResponse.json({ error: "Order is already fully arrived" }, { status: 409 });
  }

  await prisma.orderArrival.create({
    data: {
      orderId: id,
      qty,
      arrivedDate: new Date(arrivedDate),
      containerNumber: typeof containerNumber === "string" ? containerNumber.trim() || null : null,
      recordedById: user!.id,
    },
  });

  const allArrivals = [...order.arrivals, { qty, arrivedDate: new Date(arrivedDate) }];
  const { qtyReceived } = computeArrivalTotals(order.qty, allArrivals);
  const status = computeOrderStatus(order.qty, qtyReceived, true);

  const updated = await prisma.order.update({
    where: { id },
    data: { status },
    include: ORDER_DETAIL_INCLUDE,
  });

  return NextResponse.json(serializeOrderDetail(updated), { status: 201 });
}
