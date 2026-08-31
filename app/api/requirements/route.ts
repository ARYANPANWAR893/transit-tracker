import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { canCreateRequirement, canViewRequirements } from "@/lib/permissions";
import { serializeRequirementListItem, REQUIREMENT_LIST_INCLUDE } from "@/lib/requirementSerializer";
import { fulfilmentStatus } from "@/lib/quantities";
import { toIdentifierRows } from "@/lib/identifiers";
import { logActivity } from "@/lib/activityLog";
import type { Prisma, RequirementStatus } from "@/app/generated/prisma/client";

const SORTABLE = ["requestedDate", "neededByDate", "requiredQty", "status", "createdAt", "productName"] as const;
type SortField = (typeof SORTABLE)[number];
const isSortField = (v: string | null): v is SortField => !!v && (SORTABLE as readonly string[]).includes(v);

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canViewRequirements(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const p = request.nextUrl.searchParams;
  const status = p.get("status");
  const fulfilment = p.get("fulfilment");
  const familyId = p.get("familyId");
  const productId = p.get("productId");
  const search = p.get("search")?.trim();
  const sortDir = p.get("sortDir") === "asc" ? "asc" : "desc";
  const page = Math.max(1, Number(p.get("page")) || 1);
  const pageSize = Math.min(200, Math.max(1, Number(p.get("pageSize")) || 25));
  const sortBy: SortField = isSortField(p.get("sortBy")) ? (p.get("sortBy") as SortField) : "createdAt";

  const where: Prisma.RequirementWhereInput = {};
  // A requirement owner only ever sees their own demand.
  if (user.role === "REQUIREMENT_OWNER") where.createdById = user.id;
  if (status) where.status = status as RequirementStatus;
  if (productId) where.productId = productId;
  if (familyId) where.product = { familyId };
  if (search) {
    where.OR = [
      { product: { name: { contains: search, mode: "insensitive" } } },
      { product: { identifiers: { some: { value: { contains: search, mode: "insensitive" } } } } },
      { createdBy: { name: { contains: search, mode: "insensitive" } } },
    ];
  }

  const orderBy: Prisma.RequirementOrderByWithRelationInput =
    sortBy === "productName" ? { product: { name: sortDir } } : { [sortBy]: sortDir };

  const [rows, total] = await Promise.all([
    prisma.requirement.findMany({
      where, include: REQUIREMENT_LIST_INCLUDE, orderBy,
      skip: (page - 1) * pageSize, take: pageSize,
    }),
    prisma.requirement.count({ where }),
  ]);

  let items = rows.map(serializeRequirementListItem);
  // Fulfilment is derived, so it is filtered after serialization rather than in SQL.
  if (fulfilment) items = items.filter((i) => i.fulfilmentStatus === fulfilment);

  return NextResponse.json({ items, total: fulfilment ? items.length : total, page, pageSize });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!canCreateRequirement(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const { productId, product: draft, requiredQty, neededByDate, remarks, hasImage } = body;

  if (
    typeof requiredQty !== "number" || !Number.isFinite(requiredQty) || requiredQty <= 0 ||
    typeof neededByDate !== "string" || Number.isNaN(Date.parse(neededByDate))
  ) {
    return NextResponse.json({ error: "Required quantity and needed-by date are required" }, { status: 400 });
  }

  let resolvedProductId: string;
  if (typeof productId === "string" && productId) {
    const found = await prisma.product.findUnique({ where: { id: productId } });
    if (!found) return NextResponse.json({ error: "Product not found" }, { status: 404 });
    resolvedProductId = found.id;
  } else if (draft && typeof draft === "object") {
    const identifiers = toIdentifierRows(draft.identifiers);
    if (identifiers.length === 0 && !hasImage) {
      return NextResponse.json(
        { error: "Give the product at least one identifier, or attach a photo, so it can be recognised" },
        { status: 400 }
      );
    }
    try {
      const created = await prisma.product.create({
        data: {
          name: typeof draft.name === "string" && draft.name.trim() ? draft.name.trim() : "Unnamed product",
          familyId: typeof draft.familyId === "string" && draft.familyId ? draft.familyId : null,
          identifiers: { create: identifiers },
        },
      });
      resolvedProductId = created.id;
    } catch {
      return NextResponse.json({ error: "One of those identifiers is already on this product" }, { status: 409 });
    }
  } else {
    return NextResponse.json({ error: "A product is required" }, { status: 400 });
  }

  const requirement = await prisma.requirement.create({
    data: {
      productId: resolvedProductId,
      requiredQty,
      neededByDate: new Date(neededByDate),
      createdById: user!.id,
      ...(typeof remarks === "string" && remarks.trim()
        ? { remarks: { create: { authorId: user!.id, body: remarks.trim() } } }
        : {}),
    },
    include: REQUIREMENT_LIST_INCLUDE,
  });

  await logActivity({
    actor: user, action: "REQUIREMENT_CREATED", entityType: "Requirement", entityId: requirement.id,
    newValue: { productId: resolvedProductId, requiredQty, neededByDate },
  });

  return NextResponse.json(serializeRequirementListItem(requirement), { status: 201 });
}
