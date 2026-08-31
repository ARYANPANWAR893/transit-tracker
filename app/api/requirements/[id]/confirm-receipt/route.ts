import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { canConfirmReceipt } from "@/lib/permissions";
import { serializeRequirementDetail, REQUIREMENT_DETAIL_INCLUDE } from "@/lib/requirementSerializer";
import { breakdown } from "@/lib/quantities";
import { deleteBlob } from "@/lib/blob";
import { logActivity } from "@/lib/activityLog";

/**
 * Ruhi confirming goods physically reached her, against one arrived allocation.
 * Once every unit is received the identification photos have served their
 * purpose and the stored image data is deleted -- the requirement, its remarks
 * and its history all remain.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  const { id } = await params;

  const existing = await prisma.requirement.findUnique({ where: { id }, include: REQUIREMENT_DETAIL_INCLUDE });
  if (!existing) return NextResponse.json({ error: "Requirement not found" }, { status: 404 });
  if (!canConfirmReceipt(user, existing)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { allocationId, qty } = await request.json();
  const allocation = existing.allocations.find((a) => a.id === allocationId);
  if (!allocation) return NextResponse.json({ error: "That allocation isn't on this requirement" }, { status: 404 });
  if (allocation.container.status !== "ARRIVED") {
    return NextResponse.json({ error: "That container hasn't arrived yet" }, { status: 409 });
  }

  const already = allocation.receipts.reduce((s, r) => s + r.qty, 0);
  const outstanding = allocation.qty - already;
  const receiving = typeof qty === "number" && Number.isFinite(qty) && qty > 0 ? qty : outstanding;
  if (receiving > outstanding) {
    return NextResponse.json({ error: `Only ${outstanding} unit(s) are still to be received` }, { status: 400 });
  }

  await prisma.receipt.create({
    data: { allocationId: allocation.id, qty: receiving, confirmedById: user!.id },
  });

  let updated = await prisma.requirement.findUniqueOrThrow({ where: { id }, include: REQUIREMENT_DETAIL_INCLUDE });
  await logActivity({
    actor: user, action: "RECEIPT_CONFIRMED", entityType: "Requirement", entityId: id,
    newValue: { allocationId: allocation.id, containerCode: allocation.container.code, qty: receiving },
  });

  const after = breakdown(updated);
  if (after.received >= after.required && updated.photos.length > 0) {
    const results = await Promise.allSettled(updated.photos.map((p) => deleteBlob(p.url)));
    const failed = results.filter((r) => r.status === "rejected").length;
    await prisma.photo.deleteMany({ where: { requirementId: id } });
    await logActivity({
      actor: user, action: "IMAGES_DELETED", entityType: "Requirement", entityId: id,
      newValue: { count: updated.photos.length, storageDeleteFailures: failed },
      remarks: "Fully received — identification images removed from storage",
    });
    updated = await prisma.requirement.findUniqueOrThrow({ where: { id }, include: REQUIREMENT_DETAIL_INCLUDE });
  }

  return NextResponse.json(serializeRequirementDetail(updated));
}
