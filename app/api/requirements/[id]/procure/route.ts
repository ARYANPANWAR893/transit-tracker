import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { canConfirmProcurement } from "@/lib/permissions";
import { serializeRequirementDetail, REQUIREMENT_DETAIL_INCLUDE } from "@/lib/requirementSerializer";
import { breakdown } from "@/lib/quantities";
import { logActivity } from "@/lib/activityLog";

/** Anish confirming that some quantity has been procured. Several may stack up. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!canConfirmProcurement(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const existing = await prisma.requirement.findUnique({ where: { id }, include: REQUIREMENT_DETAIL_INCLUDE });
  if (!existing) return NextResponse.json({ error: "Requirement not found" }, { status: 404 });
  if (existing.status !== "REQUESTED") {
    return NextResponse.json({ error: "This requirement is no longer open" }, { status: 409 });
  }

  const { qty, notes } = await request.json();
  if (typeof qty !== "number" || !Number.isFinite(qty) || qty <= 0) {
    return NextResponse.json({ error: "Enter a quantity greater than zero" }, { status: 400 });
  }

  const before = breakdown(existing);
  if (before.procured + qty > before.required) {
    return NextResponse.json(
      { error: `That exceeds what's required — ${before.required - before.procured} still to procure` },
      { status: 400 }
    );
  }

  await prisma.procurement.create({
    data: {
      requirementId: id, qty, confirmedById: user!.id,
      notes: typeof notes === "string" && notes.trim() ? notes.trim() : null,
    },
  });

  const updated = await prisma.requirement.findUniqueOrThrow({ where: { id }, include: REQUIREMENT_DETAIL_INCLUDE });
  await logActivity({
    actor: user, action: "PROCUREMENT_CONFIRMED", entityType: "Requirement", entityId: id,
    previousValue: { procured: before.procured }, newValue: { procured: breakdown(updated).procured, added: qty },
  });

  return NextResponse.json(serializeRequirementDetail(updated));
}
