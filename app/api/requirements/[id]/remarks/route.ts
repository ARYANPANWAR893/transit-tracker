import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { canCommentOnRequirement } from "@/lib/permissions";
import { logActivity } from "@/lib/activityLog";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const requirement = await prisma.requirement.findUnique({
    where: { id }, select: { id: true, status: true, createdById: true },
  });
  if (!requirement) return NextResponse.json({ error: "Requirement not found" }, { status: 404 });
  if (!canCommentOnRequirement(user, requirement)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { body } = await request.json();
  if (typeof body !== "string" || !body.trim()) {
    return NextResponse.json({ error: "Write something first" }, { status: 400 });
  }

  const remark = await prisma.remark.create({
    data: { requirementId: id, authorId: user.id, body: body.trim() },
    include: { author: { select: { id: true, name: true } } },
  });
  await logActivity({ actor: user, action: "REMARK_ADDED", entityType: "Requirement", entityId: id });

  return NextResponse.json(
    {
      id: remark.id, requirementId: remark.requirementId, body: remark.body,
      authorId: remark.authorId, author: remark.author,
      createdAt: remark.createdAt.toISOString(), updatedAt: remark.updatedAt.toISOString(),
    },
    { status: 201 }
  );
}
