import type { Container, ContainerDetail, ContainerItem, ContainerProductLine, ContainerUpload } from "@/lib/types";
import { iso, num } from "@/lib/requirementSerializer";

const person = (p: { id: string; name: string }) => ({ id: p.id, name: p.name });

/* eslint-disable @typescript-eslint/no-explicit-any -- Prisma payload shape varies by include */
export function serializeContainer(c: any): Container {
  const allocations = c.allocations ?? [];
  return {
    id: c.id,
    code: c.code,
    status: c.status,
    loadingDate: iso(c.loadingDate),
    expectedArrivalDate: iso(c.expectedArrivalDate),
    notes: c.notes ?? null,
    createdBy: person(c.createdBy),
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
    allocationCount: allocations.length,
    totalAllocatedQty: allocations.reduce((s: number, a: any) => s + a.qty, 0),
    exceptionCount: (c.items ?? []).filter((i: any) => i.matchStatus !== "MATCHED").length,
  };
}

export function serializeContainerItem(i: any): ContainerItem {
  return {
    id: i.id,
    containerId: i.containerId,
    containerUploadId: i.containerUploadId ?? null,
    rowNumber: i.rowNumber,
    shippingMark: i.shippingMark,
    itemNo: i.itemNo,
    description: i.description,
    sectionLabel: i.sectionLabel,
    cartons: i.cartons,
    qtyPerCarton: i.qtyPerCarton,
    totalQty: i.totalQty,
    cbm: num(i.cbm),
    totalCbm: num(i.totalCbm),
    weight: num(i.weight),
    totalWeight: num(i.totalWeight),
    imageUrl: i.imageUrl,
    matchStatus: i.matchStatus,
    matchNote: i.matchNote,
    resolvedProductId: i.resolvedProductId ?? null,
    resolvedProduct: i.resolvedProduct ? { id: i.resolvedProduct.id, name: i.resolvedProduct.name } : null,
    reviewedBy: i.reviewedBy ? person(i.reviewedBy) : null,
    reviewedAt: iso(i.reviewedAt),
    createdAt: i.createdAt.toISOString(),
  };
}

export function serializeContainerUpload(u: any): ContainerUpload {
  return {
    id: u.id, containerId: u.containerId, fileName: u.fileName, blobUrl: u.blobUrl,
    status: u.status, totalRows: u.totalRows, matchedCount: u.matchedCount,
    ambiguousCount: u.ambiguousCount, unmatchedCount: u.unmatchedCount, errorCount: u.errorCount,
    uploadedBy: person(u.uploadedBy), errorMessage: u.errorMessage ?? null,
    createdAt: u.createdAt.toISOString(),
  };
}

/**
 * "Which products are in this container, and how much of each requirement do
 * they still leave outstanding?" — the Container -> Products direction.
 */
export function containerProductLines(c: any): ContainerProductLine[] {
  const byProduct = new Map<string, ContainerProductLine>();
  for (const a of c.allocations ?? []) {
    const p = a.requirement.product;
    const line = byProduct.get(p.id) ?? {
      productId: p.id, productName: p.name, required: 0, inContainer: 0, remaining: 0,
    };
    line.required += a.requirement.requiredQty;
    line.inContainer += a.qty;
    byProduct.set(p.id, line);
  }
  for (const line of byProduct.values()) {
    line.remaining = Math.max(0, line.required - line.inContainer);
  }
  return [...byProduct.values()].sort((a, b) => a.productName.localeCompare(b.productName));
}

export function serializeContainerDetail(c: any): ContainerDetail {
  return {
    ...serializeContainer(c),
    products: containerProductLines(c),
    items: (c.items ?? []).map(serializeContainerItem),
    uploads: (c.uploads ?? []).map(serializeContainerUpload),
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export const CONTAINER_LIST_INCLUDE = {
  createdBy: { select: { id: true, name: true } },
  allocations: { select: { qty: true } },
  items: { select: { matchStatus: true } },
} as const;

export const CONTAINER_DETAIL_INCLUDE = {
  createdBy: { select: { id: true, name: true } },
  allocations: {
    include: {
      requirement: { include: { product: { include: { family: true, identifiers: true } } } },
      receipts: true,
    },
  },
  items: {
    include: {
      resolvedProduct: { select: { id: true, name: true } },
      reviewedBy: { select: { id: true, name: true } },
    },
    orderBy: { rowNumber: "asc" },
  },
  uploads: {
    include: { uploadedBy: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
  },
} as const;
