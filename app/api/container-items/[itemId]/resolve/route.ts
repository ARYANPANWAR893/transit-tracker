import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { canResolveManifestExceptions } from "@/lib/permissions";
import { serializeContainerItem } from "@/lib/containerSerializer";
import { logActivity } from "@/lib/activityLog";

/**
 * A human resolving a manifest exception: either naming the product the row
 * refers to, or marking it as deliberately skipped. Never inferred.
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ itemId: string }> }) {
  const user = await getCurrentUser();
  if (!canResolveManifestExceptions(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { itemId } = await params;
  const item = await prisma.containerItem.findUnique({ where: { id: itemId } });
  if (!item) return NextResponse.json({ error: "Manifest row not found" }, { status: 404 });

  const { productId, skip } = await request.json();

  if (skip === true) {
    const updated = await prisma.containerItem.update({
      where: { id: itemId },
      data: {
        matchStatus: "UNMATCHED", matchNote: "Skipped after review",
        resolvedProductId: null, reviewedById: user!.id, reviewedAt: new Date(),
      },
      include: {
        resolvedProduct: { select: { id: true, name: true } },
        reviewedBy: { select: { id: true, name: true } },
      },
    });
    await logActivity({
      actor: user, action: "MANIFEST_ROW_SKIPPED", entityType: "Container", entityId: item.containerId,
      newValue: { itemId, rowNumber: item.rowNumber },
    });
    return NextResponse.json(serializeContainerItem(updated));
  }

  if (typeof productId !== "string" || !productId) {
    return NextResponse.json({ error: "Choose a product, or skip the row" }, { status: 400 });
  }
  const product = await prisma.product.findUnique({ where: { id: productId }, select: { id: true, name: true } });
  if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

  const updated = await prisma.containerItem.update({
    where: { id: itemId },
    data: {
      matchStatus: "MATCHED", resolvedProductId: product.id,
      matchNote: `Confirmed manually by ${user!.name}`,
      reviewedById: user!.id, reviewedAt: new Date(),
    },
    include: {
      resolvedProduct: { select: { id: true, name: true } },
      reviewedBy: { select: { id: true, name: true } },
    },
  });

  await logActivity({
    actor: user, action: "MANIFEST_ROW_RESOLVED", entityType: "Container", entityId: item.containerId,
    previousValue: { matchStatus: item.matchStatus, resolvedProductId: item.resolvedProductId },
    newValue: { matchStatus: "MATCHED", resolvedProductId: product.id, productName: product.name },
  });

  return NextResponse.json(serializeContainerItem(updated));
}
