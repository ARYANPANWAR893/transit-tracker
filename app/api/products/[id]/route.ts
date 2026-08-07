import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hasRole } from "@/lib/session";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!hasRole(user, ["ADMIN", "EDITOR"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const data: Record<string, unknown> = {};

  for (const field of ["name", "maSku", "kmSku"] as const) {
    if (field in body) {
      if (typeof body[field] !== "string" || !body[field].trim()) {
        return NextResponse.json({ error: `Invalid ${field}` }, { status: 400 });
      }
      data[field] = body[field].trim();
    }
  }

  if ("familyId" in body) {
    data.familyId = typeof body.familyId === "string" && body.familyId ? body.familyId : null;
  }

  try {
    const product = await prisma.product.update({ where: { id }, data, include: { family: true } });
    return NextResponse.json(product);
  } catch {
    return NextResponse.json(
      { error: "Product not found, or MA SKU / KM SKU already in use" },
      { status: 409 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!hasRole(user, ["ADMIN", "EDITOR"])) {
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
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }
}
