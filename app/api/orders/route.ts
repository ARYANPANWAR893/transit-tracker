import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hasRole } from "@/lib/session";
import { serializeOrderListItem, ORDER_LIST_INCLUDE } from "@/lib/orderSerializer";
import type { OrderStatus, Prisma } from "@/app/generated/prisma/client";

const SORTABLE_FIELDS = [
  "requestedDate",
  "neededByDate",
  "estArrivalDate",
  "qty",
  "status",
  "createdAt",
  "containerNumber",
  "productName",
] as const;
type SortField = (typeof SORTABLE_FIELDS)[number];

function isSortField(value: string | null): value is SortField {
  return !!value && (SORTABLE_FIELDS as readonly string[]).includes(value);
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const status = params.get("status");
  const familyId = params.get("familyId");
  const search = params.get("search")?.trim();
  const sortByParam = params.get("sortBy");
  const sortDir = params.get("sortDir") === "asc" ? "asc" : "desc";
  const page = Math.max(1, Number(params.get("page")) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(params.get("pageSize")) || 25));

  const sortBy: SortField = isSortField(sortByParam) ? sortByParam : "createdAt";

  const where: Prisma.OrderWhereInput = {};
  if (status) where.status = status as OrderStatus;
  if (familyId) where.product = { familyId };
  if (search) {
    where.OR = [
      { product: { name: { contains: search, mode: "insensitive" } } },
      { product: { maSku: { contains: search, mode: "insensitive" } } },
      { product: { kmSku: { contains: search, mode: "insensitive" } } },
      { containerNumber: { contains: search, mode: "insensitive" } },
    ];
  }

  const orderBy: Prisma.OrderOrderByWithRelationInput =
    sortBy === "productName" ? { product: { name: sortDir } } : { [sortBy]: sortDir };

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: ORDER_LIST_INCLUDE,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.order.count({ where }),
  ]);

  return NextResponse.json({
    items: orders.map(serializeOrderListItem),
    total,
    page,
    pageSize,
  });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!hasRole(user, ["ADMIN", "EDITOR"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { productId, product: newProduct, qty, neededByDate } = await request.json();

  if (
    typeof qty !== "number" ||
    !Number.isFinite(qty) ||
    qty <= 0 ||
    typeof neededByDate !== "string" ||
    Number.isNaN(Date.parse(neededByDate))
  ) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  // Either reference an existing product, or create one inline from the New Order form.
  let resolvedProductId: string;

  if (typeof productId === "string" && productId) {
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }
    resolvedProductId = product.id;
  } else if (
    newProduct &&
    typeof newProduct.name === "string" &&
    newProduct.name.trim() &&
    typeof newProduct.maSku === "string" &&
    newProduct.maSku.trim() &&
    typeof newProduct.kmSku === "string" &&
    newProduct.kmSku.trim()
  ) {
    try {
      const created = await prisma.product.create({
        data: {
          name: newProduct.name.trim(),
          maSku: newProduct.maSku.trim(),
          kmSku: newProduct.kmSku.trim(),
          familyId:
            typeof newProduct.familyId === "string" && newProduct.familyId ? newProduct.familyId : null,
        },
      });
      resolvedProductId = created.id;
    } catch {
      return NextResponse.json({ error: "MA SKU or KM SKU already in use" }, { status: 409 });
    }
  } else {
    return NextResponse.json({ error: "A product (existing or new) is required" }, { status: 400 });
  }

  const order = await prisma.order.create({
    data: {
      productId: resolvedProductId,
      qty,
      requestedDate: new Date(),
      neededByDate: new Date(neededByDate),
      status: "REQUESTED",
      createdById: user!.id,
    },
    include: ORDER_LIST_INCLUDE,
  });

  return NextResponse.json(serializeOrderListItem(order), { status: 201 });
}
