import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { canAllocate } from "@/lib/permissions";
import { serializeRequirementDetail, REQUIREMENT_DETAIL_INCLUDE } from "@/lib/requirementSerializer";
import { breakdown } from "@/lib/quantities";
import { logActivity } from "@/lib/activityLog";

/** Places procured quantity into a container. This is the Product<->Container link. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!canAllocate(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const existing = await prisma.requirement.findUnique({ where: { id }, include: REQUIREMENT_DETAIL_INCLUDE });
  if (!existing) return NextResponse.json({ error: "Requirement not found" }, { status: 404 });

  const { containerId, qty } = await request.json();
  if (typeof containerId !== "string" || !containerId) {
    return NextResponse.json({ error: "Choose a container" }, { status: 400 });
  }
  if (typeof qty !== "number" || !Number.isFinite(qty) || qty <= 0) {
    return NextResponse.json({ error: "Enter a quantity greater than zero" }, { status: 400 });
  }

  const container = await prisma.container.findUnique({ where: { id: containerId } });
  if (!container) return NextResponse.json({ error: "Container not found" }, { status: 404 });

  // Only what has actually been procured can be put into a container.
  const before = breakdown(existing);
  const allocatable = before.procured - before.allocated;
  if (qty > allocatable) {
    return NextResponse.json(
      { error: `Only ${allocatable} unit(s) are procured and not yet allocated` },
      { status: 400 }
    );
  }

  await prisma.allocation.create({
    data: { requirementId: id, containerId, qty, allocatedById: user!.id },
  });

  const updated = await prisma.requirement.findUniqueOrThrow({ where: { id }, include: REQUIREMENT_DETAIL_INCLUDE });
  await logActivity({
    actor: user, action: "ALLOCATED_TO_CONTAINER", entityType: "Requirement", entityId: id,
    newValue: { containerId, containerCode: container.code, qty },
  });

  return NextResponse.json(serializeRequirementDetail(updated));
}
