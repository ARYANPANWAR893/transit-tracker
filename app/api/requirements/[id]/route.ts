import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { canAdminOverride, canViewRequirement } from "@/lib/permissions";
import { serializeRequirementDetail, REQUIREMENT_DETAIL_INCLUDE } from "@/lib/requirementSerializer";
import { deleteBlob } from "@/lib/blob";
import { logActivity } from "@/lib/activityLog";

export async function GET(_r: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const requirement = await prisma.requirement.findUnique({ where: { id }, include: REQUIREMENT_DETAIL_INCLUDE });
  if (!requirement) return NextResponse.json({ error: "Requirement not found" }, { status: 404 });
  if (!canViewRequirement(user, requirement)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  return NextResponse.json(serializeRequirementDetail(requirement));
}

/** Admin override: the one path that may set any field, always logged as such. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!canAdminOverride(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const existing = await prisma.requirement.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Requirement not found" }, { status: 404 });

  const body = await request.json();
  const data: Record<string, unknown> = {};

  if ("requiredQty" in body) {
    if (typeof body.requiredQty !== "number" || body.requiredQty <= 0) {
      return NextResponse.json({ error: "Required quantity must be a positive number" }, { status: 400 });
    }
    data.requiredQty = body.requiredQty;
  }
  if ("neededByDate" in body) {
    if (Number.isNaN(Date.parse(body.neededByDate))) {
      return NextResponse.json({ error: "Invalid needed-by date" }, { status: 400 });
    }
    data.neededByDate = new Date(body.neededByDate);
  }
  if ("status" in body) {
    if (!["REQUESTED", "REJECTED", "WITHDRAWN"].includes(body.status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    data.status = body.status;
  }
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to change" }, { status: 400 });
  }

  const updated = await prisma.requirement.update({ where: { id }, data, include: REQUIREMENT_DETAIL_INCLUDE });

  await logActivity({
    actor: user, action: "ADMIN_OVERRIDE", entityType: "Requirement", entityId: id,
    previousValue: Object.fromEntries(
      Object.keys(data).map((k) => [k, existing[k as keyof typeof existing]])
    ),
    newValue: data,
    remarks: typeof body.reason === "string" ? body.reason : undefined,
  });

  return NextResponse.json(serializeRequirementDetail(updated));
}

export async function DELETE(_r: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!canAdminOverride(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const existing = await prisma.requirement.findUnique({ where: { id }, include: { photos: true } });
  if (!existing) return NextResponse.json({ error: "Requirement not found" }, { status: 404 });

  await Promise.allSettled(existing.photos.map((p) => deleteBlob(p.url)));
  await prisma.requirement.delete({ where: { id } });
  await logActivity({
    actor: user, action: "REQUIREMENT_DELETED", entityType: "Requirement", entityId: id,
    previousValue: { productId: existing.productId, requiredQty: existing.requiredQty },
  });

  return NextResponse.json({ ok: true });
}
