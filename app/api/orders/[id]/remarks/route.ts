import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { canCommentOnOrder } from "@/lib/permissions";
import { logActivity } from "@/lib/activityLog";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { body } = await request.json();

  if (typeof body !== "string" || !body.trim()) {
    return NextResponse.json({ error: "Remark body is required" }, { status: 400 });
  }

  const order = await prisma.order.findUnique({ where: { id }, select: { id: true, status: true, createdById: true } });
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
  if (!canCommentOnOrder(user, order)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const remark = await prisma.remark.create({
    data: { orderId: id, authorId: user.id, body: body.trim() },
    include: { author: { select: { id: true, name: true } } },
  });

  await logActivity({
    actor: user,
    action: "REMARK_ADDED",
    entityType: "Order",
    entityId: id,
    remarks: body.trim(),
  });

  return NextResponse.json(
    {
      id: remark.id,
      orderId: remark.orderId,
      body: remark.body,
      authorId: remark.authorId,
      author: remark.author,
      createdAt: remark.createdAt.toISOString(),
      updatedAt: remark.updatedAt.toISOString(),
    },
    { status: 201 }
  );
}
