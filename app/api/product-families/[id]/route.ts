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
  const { name } = await request.json();
  if (typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  try {
    const family = await prisma.productFamily.update({
      where: { id },
      data: { name: name.trim() },
    });
    return NextResponse.json(family);
  } catch {
    return NextResponse.json({ error: "Family not found or name already in use" }, { status: 409 });
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
  const productCount = await prisma.product.count({ where: { familyId: id } });
  if (productCount > 0) {
    return NextResponse.json(
      { error: `Reassign ${productCount} product(s) out of this family before deleting it` },
      { status: 409 }
    );
  }

  try {
    await prisma.productFamily.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Family not found" }, { status: 404 });
  }
}
