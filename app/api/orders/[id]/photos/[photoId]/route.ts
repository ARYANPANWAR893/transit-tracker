import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { canCommentOnOrder } from "@/lib/permissions";
import { deleteBlob } from "@/lib/blob";
import { logActivity } from "@/lib/activityLog";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; photoId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { photoId } = await params;
  const photo = await prisma.photo.findUnique({
    where: { id: photoId },
    include: { order: { select: { id: true, status: true, createdById: true } } },
  });
  if (!photo) {
    return NextResponse.json({ error: "Photo not found" }, { status: 404 });
  }
  if (!canCommentOnOrder(user, photo.order)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.photo.delete({ where: { id: photoId } });
  await deleteBlob(photo.url).catch(() => {});

  await logActivity({
    actor: user,
    action: "PHOTO_DELETED",
    entityType: "Order",
    entityId: photo.orderId,
    previousValue: { url: photo.url },
  });

  return NextResponse.json({ ok: true });
}
