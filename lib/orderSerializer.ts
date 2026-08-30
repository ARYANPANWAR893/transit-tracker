import type { OrderDetail, OrderListItem, PersonRef } from "@/lib/types";

type Decimalish = { toNumber(): number } | number | string | null | undefined;

function num(value: Decimalish): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  return value.toNumber();
}

type ProductLike = {
  id: string;
  name: string;
  amazonSku: string | null;
  amazonAsin: string | null;
  flipkartSku: string | null;
  flipkartAsin: string | null;
  meeshoSku: string | null;
  meeshoProductId: string | null;
  maSku: string | null;
  kmwId: string | null;
  familyId: string | null;
  family: { id: string; name: string; createdAt: Date; updatedAt: Date } | null;
  createdAt: Date;
  updatedAt: Date;
};

type PersonLike = { id: string; name: string };

function serializeProduct(product: ProductLike) {
  return {
    id: product.id,
    name: product.name,
    amazonSku: product.amazonSku,
    amazonAsin: product.amazonAsin,
    flipkartSku: product.flipkartSku,
    flipkartAsin: product.flipkartAsin,
    meeshoSku: product.meeshoSku,
    meeshoProductId: product.meeshoProductId,
    maSku: product.maSku,
    kmwId: product.kmwId,
    familyId: product.familyId,
    family: product.family
      ? {
          id: product.family.id,
          name: product.family.name,
          createdAt: product.family.createdAt.toISOString(),
          updatedAt: product.family.updatedAt.toISOString(),
        }
      : null,
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
  };
}

function personRef(person: PersonLike): PersonRef {
  return { id: person.id, name: person.name };
}

type OrderBase = {
  id: string;
  status: string;
  productId: string;
  product: ProductLike;

  qty: number;
  requestedPriceInr: Decimalish;
  requestedPriceCny: Decimalish;
  requestedDate: Date;
  neededByDate: Date;

  createdById: string;
  createdBy: PersonLike;

  acceptedQty: number | null;
  acceptedPriceCny: Decimalish;
  acceptedPriceInr: Decimalish;
  acceptedExpectedArrivalDate: Date | null;
  acceptanceDate: Date | null;
  acceptedById: string | null;
  acceptedBy: PersonLike | null;

  rejectionReason: string | null;
  rejectedAt: Date | null;
  rejectedById: string | null;
  rejectedBy: PersonLike | null;

  withdrawnAt: Date | null;
  withdrawnById: string | null;
  withdrawnBy: PersonLike | null;

  arrivedAt: Date | null;
  arrivedById: string | null;
  arrivedBy: PersonLike | null;

  confirmedReceivedAt: Date | null;
  confirmedById: string | null;
  confirmedBy: PersonLike | null;

  createdAt: Date;
  updatedAt: Date;
};

function baseFields(order: OrderBase) {
  return {
    id: order.id,
    status: order.status as OrderDetail["status"],
    productId: order.productId,
    product: serializeProduct(order.product),

    qty: order.qty,
    requestedPriceInr: num(order.requestedPriceInr),
    requestedPriceCny: num(order.requestedPriceCny),
    requestedDate: order.requestedDate.toISOString(),
    neededByDate: order.neededByDate.toISOString(),

    createdById: order.createdById,
    createdBy: personRef(order.createdBy),

    acceptedQty: order.acceptedQty,
    acceptedPriceCny: num(order.acceptedPriceCny),
    acceptedPriceInr: num(order.acceptedPriceInr),
    acceptedExpectedArrivalDate: order.acceptedExpectedArrivalDate?.toISOString() ?? null,
    acceptanceDate: order.acceptanceDate?.toISOString() ?? null,
    acceptedById: order.acceptedById,
    acceptedBy: order.acceptedBy ? personRef(order.acceptedBy) : null,

    rejectionReason: order.rejectionReason,
    rejectedAt: order.rejectedAt?.toISOString() ?? null,
    rejectedById: order.rejectedById,
    rejectedBy: order.rejectedBy ? personRef(order.rejectedBy) : null,

    withdrawnAt: order.withdrawnAt?.toISOString() ?? null,
    withdrawnById: order.withdrawnById,
    withdrawnBy: order.withdrawnBy ? personRef(order.withdrawnBy) : null,

    arrivedAt: order.arrivedAt?.toISOString() ?? null,
    arrivedById: order.arrivedById,
    arrivedBy: order.arrivedBy ? personRef(order.arrivedBy) : null,

    confirmedReceivedAt: order.confirmedReceivedAt?.toISOString() ?? null,
    confirmedById: order.confirmedById,
    confirmedBy: order.confirmedBy ? personRef(order.confirmedBy) : null,

    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
  };
}

export function serializeOrderListItem(
  order: OrderBase & {
    _count: { remarks: number; photos: number };
    containerItems: { containerUpload: { containerName: string } }[];
  }
): OrderListItem {
  return {
    ...baseFields(order),
    remarkCount: order._count.remarks,
    photoCount: order._count.photos,
    containerName: order.containerItems[0]?.containerUpload.containerName ?? null,
  };
}

export function serializeOrderDetail(
  order: OrderBase & {
    remarks: {
      id: string;
      orderId: string;
      body: string;
      authorId: string;
      author: PersonLike;
      createdAt: Date;
      updatedAt: Date;
    }[];
    photos: {
      id: string;
      orderId: string;
      url: string;
      source: string;
      uploadedById: string;
      uploadedBy: PersonLike;
      createdAt: Date;
    }[];
    conversions: {
      id: string;
      orderId: string;
      kind: string;
      originalAmount: Decimalish;
      originalCurrency: string;
      convertedAmount: Decimalish;
      convertedCurrency: string;
      rate: Decimalish;
      rateTimestamp: Date;
      createdAt: Date;
    }[];
    containerItems: {
      id: string;
      containerUploadId: string;
      rowNumber: number;
      shippingMark: string | null;
      itemNo: string | null;
      description: string | null;
      sectionLabel: string | null;
      cartons: number | null;
      qtyPerCarton: number | null;
      totalQty: number | null;
      cbm: Decimalish;
      totalCbm: Decimalish;
      weight: Decimalish;
      totalWeight: Decimalish;
      imageUrl: string | null;
      matchStatus: string;
      matchNote: string | null;
      matchedOrderId: string | null;
      reviewedById: string | null;
      reviewedBy: PersonLike | null;
      reviewedAt: Date | null;
      createdAt: Date;
    }[];
  }
): OrderDetail {
  return {
    ...baseFields(order),
    remarks: order.remarks
      .slice()
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((r) => ({
        id: r.id,
        orderId: r.orderId,
        body: r.body,
        authorId: r.authorId,
        author: personRef(r.author),
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      })),
    photos: order.photos
      .slice()
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((p) => ({
        id: p.id,
        orderId: p.orderId,
        url: p.url,
        source: p.source as OrderDetail["photos"][number]["source"],
        uploadedById: p.uploadedById,
        uploadedBy: personRef(p.uploadedBy),
        createdAt: p.createdAt.toISOString(),
      })),
    conversions: order.conversions
      .slice()
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .map((c) => ({
        id: c.id,
        orderId: c.orderId,
        kind: c.kind as OrderDetail["conversions"][number]["kind"],
        originalAmount: num(c.originalAmount) ?? 0,
        originalCurrency: c.originalCurrency,
        convertedAmount: num(c.convertedAmount) ?? 0,
        convertedCurrency: c.convertedCurrency,
        rate: num(c.rate) ?? 0,
        rateTimestamp: c.rateTimestamp.toISOString(),
        createdAt: c.createdAt.toISOString(),
      })),
    containerItems: order.containerItems.map((ci) => ({
      id: ci.id,
      containerUploadId: ci.containerUploadId,
      rowNumber: ci.rowNumber,
      shippingMark: ci.shippingMark,
      itemNo: ci.itemNo,
      description: ci.description,
      sectionLabel: ci.sectionLabel,
      cartons: ci.cartons,
      qtyPerCarton: ci.qtyPerCarton,
      totalQty: ci.totalQty,
      cbm: num(ci.cbm),
      totalCbm: num(ci.totalCbm),
      weight: num(ci.weight),
      totalWeight: num(ci.totalWeight),
      imageUrl: ci.imageUrl,
      matchStatus: ci.matchStatus as OrderDetail["containerItems"][number]["matchStatus"],
      matchNote: ci.matchNote,
      matchedOrderId: ci.matchedOrderId,
      reviewedById: ci.reviewedById,
      reviewedBy: ci.reviewedBy ? personRef(ci.reviewedBy) : null,
      reviewedAt: ci.reviewedAt?.toISOString() ?? null,
      createdAt: ci.createdAt.toISOString(),
    })),
  };
}

export const ORDER_LIST_INCLUDE = {
  product: { include: { family: true } },
  createdBy: { select: { id: true, name: true } },
  acceptedBy: { select: { id: true, name: true } },
  rejectedBy: { select: { id: true, name: true } },
  withdrawnBy: { select: { id: true, name: true } },
  arrivedBy: { select: { id: true, name: true } },
  confirmedBy: { select: { id: true, name: true } },
  _count: { select: { remarks: true, photos: true } },
  containerItems: { select: { containerUpload: { select: { containerName: true } } }, take: 1 },
} as const;

export const ORDER_DETAIL_INCLUDE = {
  product: { include: { family: true } },
  createdBy: { select: { id: true, name: true } },
  acceptedBy: { select: { id: true, name: true } },
  rejectedBy: { select: { id: true, name: true } },
  withdrawnBy: { select: { id: true, name: true } },
  arrivedBy: { select: { id: true, name: true } },
  confirmedBy: { select: { id: true, name: true } },
  remarks: { include: { author: { select: { id: true, name: true } } } },
  photos: { include: { uploadedBy: { select: { id: true, name: true } } } },
  conversions: true,
  containerItems: { include: { reviewedBy: { select: { id: true, name: true } } } },
} as const;
