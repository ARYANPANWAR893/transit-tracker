import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { canManageCatalog } from "@/lib/permissions";
import { serializeProduct, PRODUCT_INCLUDE } from "@/lib/requirementSerializer";
import { toIdentifierRows } from "@/lib/identifiers";
import { logActivity } from "@/lib/activityLog";

export async function GET(request: NextRequest) {
  const search = request.nextUrl.searchParams.get("search")?.trim();

  const products = await prisma.product.findMany({
    where: search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { identifiers: { some: { value: { contains: search, mode: "insensitive" } } } },
          ],
        }
      : undefined,
    include: PRODUCT_INCLUDE,
    orderBy: { name: "asc" },
  });

  return NextResponse.json(products.map(serializeProduct));
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!canManageCatalog(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const identifiers = toIdentifierRows(body.identifiers);
  if (identifiers.length === 0) {
    return NextResponse.json({ error: "Give the product at least one identifier" }, { status: 400 });
  }

  try {
    const product = await prisma.product.create({
      data: {
        name: typeof body.name === "string" && body.name.trim() ? body.name.trim() : "Unnamed product",
        familyId: typeof body.familyId === "string" && body.familyId ? body.familyId : null,
        identifiers: { create: identifiers },
      },
      include: PRODUCT_INCLUDE,
    });
    await logActivity({
      actor: user, action: "PRODUCT_CREATED", entityType: "Product", entityId: product.id,
      newValue: { name: product.name, identifiers: identifiers.map((i) => `${i.type}:${i.value}`) },
    });
    return NextResponse.json(serializeProduct(product), { status: 201 });
  } catch {
    return NextResponse.json({ error: "That product couldn't be created" }, { status: 409 });
  }
}
