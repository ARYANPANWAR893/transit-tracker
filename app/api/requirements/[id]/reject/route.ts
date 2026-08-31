import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { canRejectRequirement } from "@/lib/permissions";
import { serializeRequirementDetail, REQUIREMENT_DETAIL_INCLUDE } from "@/lib/requirementSerializer";
import { logActivity } from "@/lib/activityLog";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  const { id } = await params;

  const existing = await prisma.requirement.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Requirement not found" }, { status: 404 });
  if (!canRejectRequirement(user, existing)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { reason } = await request.json();
  // A reason is mandatory: the requester has to be told why.
  if (typeof reason !== "string" || !reason.trim()) {
    return NextResponse.json({ error: "A reason is required to reject a requirement" }, { status: 400 });
  }

  const updated = await prisma.requirement.update({
    where: { id },
    data: { status: "REJECTED", rejectionReason: reason.trim(), rejectedAt: new Date(), rejectedById: user!.id },
    include: REQUIREMENT_DETAIL_INCLUDE,
  });

  await logActivity({
    actor: user, action: "REQUIREMENT_REJECTED", entityType: "Requirement", entityId: id,
    previousValue: { status: existing.status }, newValue: { status: "REJECTED" }, remarks: reason.trim(),
  });

  return NextResponse.json(serializeRequirementDetail(updated));
}
