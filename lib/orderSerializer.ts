import { computeArrivalTotals } from "@/lib/orders";
import type { OrderDetail, OrderListItem, PersonRef } from "@/lib/types";

type ProductLike = {
  id: string;
  name: string;
  maSku: string;
  kmSku: string;
  familyId: string | null;
  family: { id: string; name: string; createdAt: Date; updatedAt: Date } | null;
  createdAt: Date;
  updatedAt: Date;
};

type PersonLike = { id: string; name: string };
type ArrivalTotalsInput = { qty: number; arrivedDate: Date };
type ArrivalLike = ArrivalTotalsInput & {
  id: string;
  orderId: string;
  containerNumber: string | null;
  recordedById: string;
  recordedBy: PersonLike;
  createdAt: Date;
};

type OrderBase = {
  id: string;
  status: string;
  productId: string;
  product: ProductLike;
  qty: number;
  requestedDate: Date;
  neededByDate: Date;
  acceptanceDate: Date | null;
  containerNumber: string | null;
  estArrivalDate: Date | null;
  createdById: string;
  createdBy: PersonLike;
  createdAt: Date;
  updatedAt: Date;
};

function serializeProduct(product: ProductLike) {
  return {
    id: product.id,
    name: product.name,
    maSku: product.maSku,
    kmSku: product.kmSku,
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

function baseFields(order: OrderBase, arrivals: ArrivalTotalsInput[]) {
  const { qtyReceived, finalArrivedDate } = computeArrivalTotals(
    order.qty,
    arrivals.map((a) => ({ qty: a.qty, arrivedDate: a.arrivedDate }))
  );

  return {
    id: order.id,
    status: order.status as OrderDetail["status"],
    productId: order.productId,
    product: serializeProduct(order.product),
    qty: order.qty,
    requestedDate: order.requestedDate.toISOString(),
    neededByDate: order.neededByDate.toISOString(),
    acceptanceDate: order.acceptanceDate?.toISOString() ?? null,
    containerNumber: order.containerNumber,
    estArrivalDate: order.estArrivalDate?.toISOString() ?? null,
    createdById: order.createdById,
    createdBy: personRef(order.createdBy),
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    qtyReceived,
    finalArrivedDate: finalArrivedDate?.toISOString() ?? null,
  };
}

export function serializeOrderListItem(
  order: OrderBase & { arrivals: ArrivalTotalsInput[]; _count: { remarks: number; photos: number } }
): OrderListItem {
  return {
    ...baseFields(order, order.arrivals),
    remarkCount: order._count.remarks,
    photoCount: order._count.photos,
  };
}

export function serializeOrderDetail(
  order: OrderBase & {
    arrivals: ArrivalLike[];
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
      uploadedById: string;
      uploadedBy: PersonLike;
      createdAt: Date;
    }[];
  }
): OrderDetail {
  return {
    ...baseFields(order, order.arrivals),
    arrivals: order.arrivals
      .slice()
      .sort((a, b) => a.arrivedDate.getTime() - b.arrivedDate.getTime())
      .map((a) => ({
        id: a.id,
        orderId: a.orderId,
        qty: a.qty,
        arrivedDate: a.arrivedDate.toISOString(),
        containerNumber: a.containerNumber,
        recordedById: a.recordedById,
        recordedBy: personRef(a.recordedBy),
        createdAt: a.createdAt.toISOString(),
      })),
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
        uploadedById: p.uploadedById,
        uploadedBy: personRef(p.uploadedBy),
        createdAt: p.createdAt.toISOString(),
      })),
  };
}

const ORDER_LIST_INCLUDE = {
  product: { include: { family: true } },
  createdBy: { select: { id: true, name: true } },
  arrivals: { select: { qty: true, arrivedDate: true } },
  _count: { select: { remarks: true, photos: true } },
} as const;

const ORDER_DETAIL_INCLUDE = {
  product: { include: { family: true } },
  createdBy: { select: { id: true, name: true } },
  arrivals: { include: { recordedBy: { select: { id: true, name: true } } } },
  remarks: { include: { author: { select: { id: true, name: true } } } },
  photos: { include: { uploadedBy: { select: { id: true, name: true } } } },
} as const;

export { ORDER_LIST_INCLUDE, ORDER_DETAIL_INCLUDE };
