import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { canConfirmReceipt } from "@/lib/permissions";
import { serializeOrderDetail, ORDER_DETAIL_INCLUDE } from "@/lib/orderSerializer";
import { logActivity } from "@/lib/activityLog";
import { deleteBlob } from "@/lib/blob";

/**
 * Orderer confirms physical receipt. Per the image lifecycle requirement:
 * once arrival is confirmed, stored images for this order are no longer
 * needed — delete the blobs AND the Photo rows, but keep everything else
 * (remarks, conversions, container match history, the order itself).
 */
export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await prisma.order.findUnique({ where: { id }, include: { photos: true } });
  if (!existing) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  if (!canConfirmReceipt(user, existing)) {
    return NextResponse.json({ error: "This order isn't awaiting your confirmation" }, { status: 403 });
  }

  const order = await prisma.order.update({
    where: { id },
    data: { status: "CONFIRMED_RECEIVED", confirmedReceivedAt: new Date(), confirmedById: user.id },
    include: ORDER_DETAIL_INCLUDE,
  });

  await logActivity({
    actor: user,
    action: "ORDER_CONFIRMED_RECEIVED",
    entityType: "Order",
    entityId: id,
    previousValue: { status: existing.status },
    newValue: { status: "CONFIRMED_RECEIVED" },
  });

  if (existing.photos.length > 0) {
    const results = await Promise.allSettled(existing.photos.map((photo) => deleteBlob(photo.url)));
    await prisma.photo.deleteMany({ where: { orderId: id } });

    const failures = results.filter((r) => r.status === "rejected").length;
    await logActivity({
      actor: user,
      action: "IMAGES_DELETED",
      entityType: "Order",
      entityId: id,
      remarks: `${existing.photos.length} image(s) deleted after confirmed receipt${
        failures ? ` (${failures} blob deletion(s) failed, DB rows still removed)` : ""
      }`,
    });
  }

  return NextResponse.json({
    ...serializeOrderDetail(order),
    photos: [],
  });
}
