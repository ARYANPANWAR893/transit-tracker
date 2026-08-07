import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hasRole } from "@/lib/session";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; remarkId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { remarkId } = await params;
  const existing = await prisma.remark.findUnique({ where: { id: remarkId } });
  if (!existing) {
    return NextResponse.json({ error: "Remark not found" }, { status: 404 });
  }
  if (existing.authorId !== user.id && !hasRole(user, ["ADMIN"])) {
    return NextResponse.json({ error: "You can only edit your own remarks" }, { status: 403 });
  }

  const { body } = await request.json();
  if (typeof body !== "string" || !body.trim()) {
    return NextResponse.json({ error: "Remark body is required" }, { status: 400 });
  }

  const remark = await prisma.remark.update({
    where: { id: remarkId },
    data: { body: body.trim() },
    include: { author: { select: { id: true, name: true } } },
  });

  return NextResponse.json({
    id: remark.id,
    orderId: remark.orderId,
    body: remark.body,
    authorId: remark.authorId,
    author: remark.author,
    createdAt: remark.createdAt.toISOString(),
    updatedAt: remark.updatedAt.toISOString(),
  });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; remarkId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { remarkId } = await params;
  const existing = await prisma.remark.findUnique({ where: { id: remarkId } });
  if (!existing) {
    return NextResponse.json({ error: "Remark not found" }, { status: 404 });
  }
  if (existing.authorId !== user.id && !hasRole(user, ["ADMIN"])) {
    return NextResponse.json({ error: "You can only delete your own remarks" }, { status: 403 });
  }

  await prisma.remark.delete({ where: { id: remarkId } });
  return NextResponse.json({ ok: true });
}
