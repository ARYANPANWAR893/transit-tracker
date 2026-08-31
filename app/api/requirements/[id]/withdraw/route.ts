import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { canWithdrawRequirement } from "@/lib/permissions";
import { serializeRequirementDetail, REQUIREMENT_DETAIL_INCLUDE } from "@/lib/requirementSerializer";
import { logActivity } from "@/lib/activityLog";

export async function PATCH(_r: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  const { id } = await params;

  const existing = await prisma.requirement.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Requirement not found" }, { status: 404 });
  if (!canWithdrawRequirement(user, existing)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const updated = await prisma.requirement.update({
    where: { id },
    data: { status: "WITHDRAWN", withdrawnAt: new Date(), withdrawnById: user!.id },
    include: REQUIREMENT_DETAIL_INCLUDE,
  });

  await logActivity({
    actor: user, action: "REQUIREMENT_WITHDRAWN", entityType: "Requirement", entityId: id,
    previousValue: { status: existing.status }, newValue: { status: "WITHDRAWN" },
  });

  return NextResponse.json(serializeRequirementDetail(updated));
}
