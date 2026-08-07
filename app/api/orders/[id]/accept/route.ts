import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hasRole } from "@/lib/session";
import { serializeOrderDetail, ORDER_DETAIL_INCLUDE } from "@/lib/orderSerializer";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!hasRole(user, ["ADMIN", "EDITOR"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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

  const existing = await prisma.order.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
  if (existing.status !== "REQUESTED") {
    return NextResponse.json({ error: "Only requested orders can be accepted" }, { status: 409 });
  }

  const order = await prisma.order.update({
    where: { id },
    data: {
      status: "ACCEPTED",
      containerNumber: containerNumber.trim(),
      estArrivalDate: new Date(estArrivalDate),
      acceptanceDate: new Date(),
    },
    include: ORDER_DETAIL_INCLUDE,
  });

  return NextResponse.json(serializeOrderDetail(order));
}
