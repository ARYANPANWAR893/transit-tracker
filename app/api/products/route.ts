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

function cleanStr(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function GET(request: NextRequest) {
  const search = request.nextUrl.searchParams.get("search")?.trim();

  const products = await prisma.product.findMany({
    where: search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            ...IDENTIFIER_FIELDS.map((f) => ({ [f]: { contains: search, mode: "insensitive" as const } })),
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
  if (!canManageCatalog(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const identifiers = Object.fromEntries(
    IDENTIFIER_FIELDS.map((f) => [f, cleanStr(body[f])])
  ) as Record<(typeof IDENTIFIER_FIELDS)[number], string | null>;

  if (!IDENTIFIER_FIELDS.some((f) => identifiers[f])) {
    return NextResponse.json({ error: "At least one product identifier is required" }, { status: 400 });
  }

  try {
    const product = await prisma.product.create({
      data: {
        name: cleanStr(body.name) || "Unnamed product",
        ...identifiers,
        familyId: typeof body.familyId === "string" && body.familyId ? body.familyId : null,
      },
      include: { family: true },
    });

    await logActivity({
      actor: user,
      action: "PRODUCT_CREATED",
      entityType: "Product",
      entityId: product.id,
      newValue: { name: product.name, ...identifiers },
    });

    return NextResponse.json(product, { status: 201 });
  } catch {
    return NextResponse.json({ error: "One of the identifiers is already in use" }, { status: 409 });
  }
}
