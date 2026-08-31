import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { isAdmin } from "@/lib/permissions";
import { logActivity } from "@/lib/activityLog";

/** Authors edit their own remarks; Admin can remove any. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string; remarkId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { remarkId } = await params;
  const existing = await prisma.remark.findUnique({ where: { id: remarkId } });
  if (!existing) return NextResponse.json({ error: "Remark not found" }, { status: 404 });
  if (existing.authorId !== user.id && !isAdmin(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { body } = await request.json();
  if (typeof body !== "string" || !body.trim()) {
    return NextResponse.json({ error: "Write something first" }, { status: 400 });
  }

  const remark = await prisma.remark.update({
    where: { id: remarkId }, data: { body: body.trim() },
    include: { author: { select: { id: true, name: true } } },
  });
  await logActivity({
    actor: user, action: "REMARK_EDITED", entityType: "Requirement", entityId: existing.requirementId,
    previousValue: { body: existing.body }, newValue: { body: remark.body },
  });

  return NextResponse.json({
    id: remark.id, requirementId: remark.requirementId, body: remark.body,
    authorId: remark.authorId, author: remark.author,
    createdAt: remark.createdAt.toISOString(), updatedAt: remark.updatedAt.toISOString(),
  });
}

export async function DELETE(_r: NextRequest, { params }: { params: Promise<{ id: string; remarkId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { remarkId } = await params;
  const existing = await prisma.remark.findUnique({ where: { id: remarkId } });
  if (!existing) return NextResponse.json({ error: "Remark not found" }, { status: 404 });
  if (existing.authorId !== user.id && !isAdmin(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.remark.delete({ where: { id: remarkId } });
  await logActivity({
    actor: user, action: "REMARK_DELETED", entityType: "Requirement", entityId: existing.requirementId,
    previousValue: { body: existing.body },
  });
  return NextResponse.json({ ok: true });
}
