import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hasRole } from "@/lib/session";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!hasRole(user, ["ADMIN", "EDITOR"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const { body } = await request.json();

  if (typeof body !== "string" || !body.trim()) {
    return NextResponse.json({ error: "Remark body is required" }, { status: 400 });
  }

  const order = await prisma.order.findUnique({ where: { id }, select: { id: true } });
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const remark = await prisma.remark.create({
    data: { orderId: id, authorId: user!.id, body: body.trim() },
    include: { author: { select: { id: true, name: true } } },
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
