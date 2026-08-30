import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { canManageCatalog } from "@/lib/permissions";
import { logActivity } from "@/lib/activityLog";

const IDENTIFIER_FIELDS = [
  "amazonSku",
  "amazonAsin",
  "flipkartSku",
  "flipkartAsin",
  "meeshoSku",
  "meeshoProductId",
  "maSku",
  "kmwId",
] as const;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!canManageCatalog(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Product not found" }, { status: 404 });

  const body = await request.json();
  const data: Record<string, unknown> = {};

  if ("name" in body) {
    if (typeof body.name !== "string" || !body.name.trim()) {
      return NextResponse.json({ error: "Invalid name" }, { status: 400 });
    }
    data.name = body.name.trim();
  }

  for (const field of IDENTIFIER_FIELDS) {
    if (field in body) {
      data[field] = typeof body[field] === "string" && body[field].trim() ? body[field].trim() : null;
    }
  }

  if ("familyId" in body) {
    data.familyId = typeof body.familyId === "string" && body.familyId ? body.familyId : null;
  }

  // Guard against ending up with zero identifiers (name alone can't identify a product).
  const resultingIdentifiers = IDENTIFIER_FIELDS.map((f) =>
    f in data ? data[f] : existing[f as keyof typeof existing]
  );
  if (!resultingIdentifiers.some(Boolean)) {
    return NextResponse.json({ error: "At least one product identifier is required" }, { status: 400 });
  }

  try {
    const product = await prisma.product.update({ where: { id }, data, include: { family: true } });

    await logActivity({
      actor: user,
      action: "PRODUCT_EDITED",
      entityType: "Product",
      entityId: id,
      previousValue: Object.fromEntries(Object.keys(data).map((k) => [k, existing[k as keyof typeof existing]])),
      newValue: data,
    });

    return NextResponse.json(product);
  } catch {
    return NextResponse.json(
      { error: "Product not found, or an identifier is already in use" },
      { status: 409 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!canManageCatalog(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const orderCount = await prisma.order.count({ where: { productId: id } });
  if (orderCount > 0) {
    return NextResponse.json(
      { error: `${orderCount} order(s) reference this product; it can't be deleted` },
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
