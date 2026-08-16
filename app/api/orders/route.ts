import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { canCreateOrder } from "@/lib/permissions";
import { serializeOrderListItem, ORDER_LIST_INCLUDE } from "@/lib/orderSerializer";
import { convertCurrency } from "@/lib/currency";
import { logActivity } from "@/lib/activityLog";
import type { OrderStatus, Prisma } from "@/app/generated/prisma/client";

const SORTABLE_FIELDS = [
  "requestedDate",
  "neededByDate",
  "qty",
  "status",
  "createdAt",
  "requestedPriceInr",
  "productName",
] as const;
type SortField = (typeof SORTABLE_FIELDS)[number];

function isSortField(value: string | null): value is SortField {
  return !!value && (SORTABLE_FIELDS as readonly string[]).includes(value);
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const params = request.nextUrl.searchParams;
  const status = params.get("status");
  const familyId = params.get("familyId");
  const search = params.get("search")?.trim();
  const sortByParam = params.get("sortBy");
  const sortDir = params.get("sortDir") === "asc" ? "asc" : "desc";
  const page = Math.max(1, Number(params.get("page")) || 1);
  const pageSize = Math.min(200, Math.max(1, Number(params.get("pageSize")) || 25));

  const sortBy: SortField = isSortField(sortByParam) ? sortByParam : "createdAt";

  const where: Prisma.OrderWhereInput = {};

  // Orderers only ever see their own orders. Order Accepters and Admins see everything.
  if (user.role === "ORDERER") {
    where.createdById = user.id;
  }

  if (status) where.status = status as OrderStatus;
  if (familyId) where.product = { familyId };
  if (search) {
    where.OR = [
      { product: { name: { contains: search, mode: "insensitive" } } },
      { product: { maSku: { contains: search, mode: "insensitive" } } },
      { product: { kmwId: { contains: search, mode: "insensitive" } } },
      { product: { amazonSku: { contains: search, mode: "insensitive" } } },
      { product: { amazonAsin: { contains: search, mode: "insensitive" } } },
      { product: { flipkartSku: { contains: search, mode: "insensitive" } } },
      { product: { flipkartAsin: { contains: search, mode: "insensitive" } } },
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

const IDENTIFIER_FIELDS = ["amazonSku", "amazonAsin", "flipkartSku", "flipkartAsin", "maSku", "kmwId"] as const;

function cleanStr(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!canCreateOrder(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { productId, product: newProduct, qty, requestedPriceInr, neededByDate, remarks, hasImage } = body;

  if (
    typeof qty !== "number" ||
    !Number.isFinite(qty) ||
    qty <= 0 ||
    typeof requestedPriceInr !== "number" ||
    !Number.isFinite(requestedPriceInr) ||
    requestedPriceInr <= 0 ||
    typeof neededByDate !== "string" ||
    Number.isNaN(Date.parse(neededByDate))
  ) {
    return NextResponse.json({ error: "Quantity, INR price, and needed-by date are required" }, { status: 400 });
  }

  // Resolve the product: either an existing one, or an inline draft with at
  // least one of the six identifiers (or a to-be-attached photo).
  let resolvedProductId: string;

  if (typeof productId === "string" && productId) {
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });
    resolvedProductId = product.id;
  } else if (newProduct && typeof newProduct === "object") {
    const identifiers = Object.fromEntries(
      IDENTIFIER_FIELDS.map((f) => [f, cleanStr(newProduct[f])])
    ) as Record<(typeof IDENTIFIER_FIELDS)[number], string | null>;
    const anyIdentifier = IDENTIFIER_FIELDS.some((f) => identifiers[f]);

    if (!anyIdentifier && !hasImage) {
      return NextResponse.json(
        { error: "Provide at least one product identifier (or a photo) to identify the product" },
        { status: 400 }
      );
    }

    try {
      const created = await prisma.product.create({
        data: {
          name: cleanStr(newProduct.name) || "Unnamed product",
          ...identifiers,
          familyId: typeof newProduct.familyId === "string" && newProduct.familyId ? newProduct.familyId : null,
        },
      });
      resolvedProductId = created.id;
    } catch {
      return NextResponse.json({ error: "One of the identifiers is already in use" }, { status: 409 });
    }
  } else {
    return NextResponse.json({ error: "A product (existing or new) is required" }, { status: 400 });
  }

  // Convert INR -> CNY and keep the full audit trail, not just the number.
  let requestedPriceCny: number | null = null;
  let conversion: Awaited<ReturnType<typeof convertCurrency>> | null = null;
  try {
    conversion = await convertCurrency(requestedPriceInr, "INR", "CNY");
    requestedPriceCny = conversion.convertedAmount;
  } catch (err) {
    // Order creation shouldn't hard-fail just because the FX API had a blip;
    // the conversion can be retried/backfilled, but we surface the failure.
    console.error("Currency conversion failed on order creation:", err);
  }

  const order = await prisma.order.create({
    data: {
      productId: resolvedProductId,
      qty,
      requestedPriceInr,
      requestedPriceCny,
      requestedDate: new Date(),
      neededByDate: new Date(neededByDate),
      status: "REQUESTED",
      createdById: user!.id,
      ...(conversion
        ? {
            conversions: {
              create: {
                kind: "REQUEST",
                originalAmount: requestedPriceInr,
                originalCurrency: "INR",
                convertedAmount: conversion.convertedAmount,
                convertedCurrency: "CNY",
                rate: conversion.rate,
                rateTimestamp: conversion.rateTimestamp,
              },
            },
          }
        : {}),
      ...(typeof remarks === "string" && remarks.trim()
        ? { remarks: { create: { authorId: user!.id, body: remarks.trim() } } }
        : {}),
    },
    include: ORDER_LIST_INCLUDE,
  });

  await logActivity({
    actor: user,
    action: "ORDER_CREATED",
    entityType: "Order",
    entityId: order.id,
    newValue: { productId: resolvedProductId, qty, requestedPriceInr, requestedPriceCny },
  });

  return NextResponse.json(serializeOrderListItem(order), { status: 201 });
}
