import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { canActOnFulfillment } from "@/lib/permissions";
import { logActivity } from "@/lib/activityLog";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const user = await getCurrentUser();
  if (!canActOnFulfillment(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { itemId } = await params;
  const { orderId, skip } = await request.json();

  const item = await prisma.containerItem.findUnique({ where: { id: itemId } });
  if (!item) return NextResponse.json({ error: "Container item not found" }, { status: 404 });
  if (item.matchStatus !== "AMBIGUOUS" && item.matchStatus !== "UNMATCHED") {
    return NextResponse.json({ error: "This row has already been resolved" }, { status: 409 });
  }

  if (skip === true) {
    const updated = await prisma.containerItem.update({
      where: { id: itemId },
      data: { matchStatus: "UNMATCHED", reviewedById: user!.id, reviewedAt: new Date(), matchNote: "Manually skipped" },
    });
    await logActivity({
      actor: user,
      action: "CONTAINER_MATCH_SKIPPED",
      entityType: "ContainerItem",
      entityId: itemId,
    });
    return NextResponse.json({ ok: true, item: updated });
  }

  if (typeof orderId !== "string" || !orderId) {
    return NextResponse.json({ error: "orderId (or skip: true) is required" }, { status: 400 });
  }

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  if (order.status !== "ACCEPTED") {
    return NextResponse.json({ error: "Only accepted orders can be matched to a container" }, { status: 409 });
  }

  let matchNote: string | null = null;
  if (item.totalQty !== null && order.acceptedQty !== null && item.totalQty !== order.acceptedQty) {
    matchNote = `Quantity mismatch: container has ${item.totalQty}, accepted qty was ${order.acceptedQty}`;
  }

  const updatedItem = await prisma.containerItem.update({
    where: { id: itemId },
    data: {
      matchStatus: "MATCHED",
      matchedOrderId: order.id,
      matchNote,
      reviewedById: user!.id,
      reviewedAt: new Date(),
    },
  });

  if (item.imageUrl) {
    await prisma.photo.create({
      data: {
        orderId: order.id,
        url: item.imageUrl,
        blobPathname: new URL(item.imageUrl).pathname.replace(/^\//, ""),
        source: "CONTAINER_IMPORT",
        uploadedById: user!.id,
      },
    });
  }

  await prisma.order.update({ where: { id: order.id }, data: { status: "IN_TRANSIT" } });

  await logActivity({
    actor: user,
    action: "CONTAINER_MATCH_CONFIRMED",
    entityType: "Order",
    entityId: order.id,
    newValue: { containerItemId: itemId, rowNumber: item.rowNumber },
    remarks: matchNote,
  });

  return NextResponse.json({ ok: true, item: updatedItem });
}
