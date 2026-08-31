import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { canManageCatalog } from "@/lib/permissions";
import { serializeProduct, serializeRequirementListItem, PRODUCT_INCLUDE, REQUIREMENT_LIST_INCLUDE } from "@/lib/requirementSerializer";
import { aggregate } from "@/lib/quantities";
import { toIdentifierRows } from "@/lib/identifiers";
import { logActivity } from "@/lib/activityLog";
import type { ProductContainerLine, ProductDetail } from "@/lib/types";

/** "Where is this product?" — quantities plus every container carrying it. */
export async function GET(_r: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const product = await prisma.product.findUnique({ where: { id }, include: PRODUCT_INCLUDE });
  if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

  const requirements = await prisma.requirement.findMany({
    where: {
      productId: id,
      ...(user.role === "REQUIREMENT_OWNER" ? { createdById: user.id } : {}),
    },
    include: REQUIREMENT_LIST_INCLUDE,
    orderBy: { createdAt: "desc" },
  });

  // Roll every allocation of this product up by container.
  const byContainer = new Map<string, ProductContainerLine>();
  for (const r of requirements) {
    if (r.status !== "REQUESTED") continue;
    for (const a of r.allocations) {
      const line = byContainer.get(a.containerId) ?? {
        containerId: a.containerId,
        code: a.container.code,
        qty: 0,
        receivedQty: 0,
        loadingDate: a.container.loadingDate?.toISOString() ?? null,
        expectedArrivalDate: a.container.expectedArrivalDate?.toISOString() ?? null,
        status: a.container.status,
      };
      line.qty += a.qty;
      line.receivedQty += a.receipts.reduce((s, x) => s + x.qty, 0);
      byContainer.set(a.containerId, line);
    }
  }

  const detail: ProductDetail = {
    product: serializeProduct(product),
    quantities: aggregate(requirements),
    containers: [...byContainer.values()].sort((a, b) =>
      (a.loadingDate ?? "").localeCompare(b.loadingDate ?? "") || a.code.localeCompare(b.code)
    ),
    requirements: requirements.map(serializeRequirementListItem),
  };
  return NextResponse.json(detail);
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!canManageCatalog(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const existing = await prisma.product.findUnique({ where: { id }, include: PRODUCT_INCLUDE });
  if (!existing) return NextResponse.json({ error: "Product not found" }, { status: 404 });

  const body = await request.json();
  const data: Record<string, unknown> = {};
  if ("name" in body) {
    if (typeof body.name !== "string" || !body.name.trim()) {
      return NextResponse.json({ error: "Enter a product name" }, { status: 400 });
    }
    data.name = body.name.trim();
  }
  if ("familyId" in body) {
    data.familyId = typeof body.familyId === "string" && body.familyId ? body.familyId : null;
  }

  // Identifiers are replaced wholesale when supplied.
  if ("identifiers" in body) {
    const rows = toIdentifierRows(body.identifiers);
    if (rows.length === 0) {
      return NextResponse.json({ error: "A product needs at least one identifier" }, { status: 400 });
    }
    await prisma.productIdentifier.deleteMany({ where: { productId: id } });
    await prisma.productIdentifier.createMany({ data: rows.map((r) => ({ ...r, productId: id })) });
  }

  const product = await prisma.product.update({ where: { id }, data, include: PRODUCT_INCLUDE });
  await logActivity({
    actor: user, action: "PRODUCT_EDITED", entityType: "Product", entityId: id,
    previousValue: { name: existing.name, identifiers: existing.identifiers.map((i) => `${i.type}:${i.value}`) },
    newValue: { name: product.name, identifiers: product.identifiers.map((i) => `${i.type}:${i.value}`) },
  });

  return NextResponse.json(serializeProduct(product));
}

export async function DELETE(_r: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!canManageCatalog(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const count = await prisma.requirement.count({ where: { productId: id } });
  if (count > 0) {
    return NextResponse.json(
      { error: `${count} requirement(s) reference this product, so it can't be deleted` },
      { status: 409 }
    );
  }

  try {
    await prisma.product.delete({ where: { id } });
    await logActivity({ actor: user, action: "PRODUCT_DELETED", entityType: "Product", entityId: id });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }
}
