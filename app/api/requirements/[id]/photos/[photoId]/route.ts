import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { canCommentOnRequirement } from "@/lib/permissions";
import { deleteBlob } from "@/lib/blob";
import { logActivity } from "@/lib/activityLog";

export async function DELETE(_r: NextRequest, { params }: { params: Promise<{ id: string; photoId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, photoId } = await params;
  const requirement = await prisma.requirement.findUnique({
    where: { id }, select: { id: true, status: true, createdById: true },
  });
  if (!requirement) return NextResponse.json({ error: "Requirement not found" }, { status: 404 });
  if (!canCommentOnRequirement(user, requirement)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const photo = await prisma.photo.findUnique({ where: { id: photoId } });
  if (!photo || photo.requirementId !== id) {
    return NextResponse.json({ error: "Photo not found" }, { status: 404 });
  }

  await deleteBlob(photo.url).catch(() => {});
  await prisma.photo.delete({ where: { id: photoId } });
  await logActivity({ actor: user, action: "PHOTO_DELETED", entityType: "Requirement", entityId: id });

  return NextResponse.json({ ok: true });
}
