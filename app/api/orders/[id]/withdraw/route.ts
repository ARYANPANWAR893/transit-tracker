import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { canWithdrawOrder, isAdmin } from "@/lib/permissions";
import { serializeOrderDetail, ORDER_DETAIL_INCLUDE } from "@/lib/orderSerializer";
import { logActivity } from "@/lib/activityLog";

export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await prisma.order.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  if (!canWithdrawOrder(user, existing)) {
    return NextResponse.json({ error: "This order can no longer be withdrawn" }, { status: 403 });
  }

  const order = await prisma.order.update({
    where: { id },
    data: { status: "WITHDRAWN", withdrawnAt: new Date(), withdrawnById: user.id },
    include: ORDER_DETAIL_INCLUDE,
  });

  await logActivity({
    actor: user,
    action: isAdmin(user) && existing.createdById !== user.id ? "ORDER_WITHDRAWN_ADMIN_OVERRIDE" : "ORDER_WITHDRAWN",
    entityType: "Order",
    entityId: id,
    previousValue: { status: existing.status },
    newValue: { status: "WITHDRAWN" },
  });

  return NextResponse.json(serializeOrderDetail(order));
}
