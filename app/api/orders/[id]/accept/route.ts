import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { canActOnFulfillment } from "@/lib/permissions";
import { serializeOrderDetail, ORDER_DETAIL_INCLUDE } from "@/lib/orderSerializer";
import { convertCurrency } from "@/lib/currency";
import { logActivity } from "@/lib/activityLog";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!canActOnFulfillment(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const { acceptedQty, acceptedPriceCny, acceptedExpectedArrivalDate, remarks } = await request.json();

  if (
    typeof acceptedQty !== "number" ||
    !Number.isFinite(acceptedQty) ||
    acceptedQty <= 0 ||
    typeof acceptedPriceCny !== "number" ||
    !Number.isFinite(acceptedPriceCny) ||
    acceptedPriceCny <= 0 ||
    typeof acceptedExpectedArrivalDate !== "string" ||
    Number.isNaN(Date.parse(acceptedExpectedArrivalDate))
  ) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const existing = await prisma.order.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  if (existing.status !== "REQUESTED") {
    return NextResponse.json({ error: "Only requested orders can be accepted" }, { status: 409 });
  }

  let acceptedPriceInr: number | null = null;
  let conversion: Awaited<ReturnType<typeof convertCurrency>> | null = null;
  try {
    conversion = await convertCurrency(acceptedPriceCny, "CNY", "INR");
    acceptedPriceInr = conversion.convertedAmount;
  } catch (err) {
    console.error("Currency conversion failed on order acceptance:", err);
  }

  const order = await prisma.order.update({
    where: { id },
    data: {
      status: "ACCEPTED",
      acceptedQty,
      acceptedPriceCny,
      acceptedPriceInr,
      acceptedExpectedArrivalDate: new Date(acceptedExpectedArrivalDate),
      acceptanceDate: new Date(),
      acceptedById: user!.id,
      ...(conversion
        ? {
            conversions: {
              create: {
                kind: "ACCEPTANCE",
                originalAmount: acceptedPriceCny,
                originalCurrency: "CNY",
                convertedAmount: conversion.convertedAmount,
                convertedCurrency: "INR",
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
    include: ORDER_DETAIL_INCLUDE,
  });

  await logActivity({
    actor: user,
    action: "ORDER_ACCEPTED",
    entityType: "Order",
    entityId: id,
    previousValue: { status: existing.status, qty: existing.qty },
    newValue: { status: "ACCEPTED", acceptedQty, acceptedPriceCny, acceptedPriceInr },
  });

  return NextResponse.json(serializeOrderDetail(order));
}
