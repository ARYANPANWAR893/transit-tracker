import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { canCommentOnOrder } from "@/lib/permissions";
import { uploadBlob } from "@/lib/blob";
import { logActivity } from "@/lib/activityLog";

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const order = await prisma.order.findUnique({ where: { id }, select: { id: true, status: true, createdById: true } });
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
  if (!canCommentOnOrder(user, order)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File) || !file.type.startsWith("image/")) {
    return NextResponse.json({ error: "An image file is required" }, { status: 400 });
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: "Image must be under 10MB" }, { status: 400 });
  }

  const pathname = `orders/${id}/${crypto.randomUUID()}-${file.name}`;
  const { url, pathname: blobPathname } = await uploadBlob(pathname, file);

  const photo = await prisma.photo.create({
    data: { orderId: id, url, blobPathname, uploadedById: user.id, source: "ORDERER_UPLOAD" },
    include: { uploadedBy: { select: { id: true, name: true } } },
  });

  await logActivity({
    actor: user,
    action: "PHOTO_UPLOADED",
    entityType: "Order",
    entityId: id,
    newValue: { url },
  });

  return NextResponse.json(
    {
      id: photo.id,
      orderId: photo.orderId,
      url: photo.url,
      source: photo.source,
      uploadedById: photo.uploadedById,
      uploadedBy: photo.uploadedBy,
      createdAt: photo.createdAt.toISOString(),
    },
    { status: 201 }
  );
}
