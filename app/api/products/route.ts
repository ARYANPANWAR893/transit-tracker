import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hasRole } from "@/lib/session";

export async function GET(request: NextRequest) {
  const search = request.nextUrl.searchParams.get("search")?.trim();

  const products = await prisma.product.findMany({
    where: search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { maSku: { contains: search, mode: "insensitive" } },
            { kmSku: { contains: search, mode: "insensitive" } },
          ],
        }
      : undefined,
    include: { family: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(products);
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!hasRole(user, ["ADMIN", "EDITOR"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { name, maSku, kmSku, familyId } = await request.json();

  if (
    typeof name !== "string" ||
    !name.trim() ||
    typeof maSku !== "string" ||
    !maSku.trim() ||
    typeof kmSku !== "string" ||
    !kmSku.trim()
  ) {
    return NextResponse.json({ error: "Name, MA SKU, and KM SKU are required" }, { status: 400 });
  }

  try {
    const product = await prisma.product.create({
      data: {
        name: name.trim(),
        maSku: maSku.trim(),
        kmSku: kmSku.trim(),
        familyId: typeof familyId === "string" && familyId ? familyId : null,
      },
      include: { family: true },
    });
    return NextResponse.json(product, { status: 201 });
  } catch {
    return NextResponse.json({ error: "MA SKU or KM SKU already in use" }, { status: 409 });
  }
}
