import type {
  Allocation, ContainerRef, PersonRef, Photo, Procurement, Product,
  Remark, RequirementDetail, RequirementListItem,
} from "@/lib/types";
import { breakdown, fulfilmentStatus } from "@/lib/quantities";

type Decimalish = { toNumber(): number } | number | string | null | undefined;
const num = (v: Decimalish): number | null =>
  v === null || v === undefined ? null : typeof v === "number" ? v : typeof v === "string" ? Number(v) : v.toNumber();

const person = (p: { id: string; name: string }): PersonRef => ({ id: p.id, name: p.name });
export const iso = (d: Date | null | undefined): string | null => d?.toISOString() ?? null;

export function serializeProduct(product: {
  id: string; name: string; familyId: string | null;
  family: { id: string; name: string; createdAt: Date; updatedAt: Date } | null;
  identifiers: { id: string; type: string; value: string; normalizedValue: string }[];
  createdAt: Date; updatedAt: Date;
}): Product {
  return {
    id: product.id,
    name: product.name,
    familyId: product.familyId,
    family: product.family
      ? {
          id: product.family.id, name: product.family.name,
          createdAt: product.family.createdAt.toISOString(),
          updatedAt: product.family.updatedAt.toISOString(),
        }
      : null,
    identifiers: product.identifiers.map((i) => ({
      id: i.id,
      type: i.type as Product["identifiers"][number]["type"],
      value: i.value,
      normalizedValue: i.normalizedValue,
    })),
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
  };
}

export function serializeContainerRef(c: {
  id: string; code: string; status: string; loadingDate: Date | null; expectedArrivalDate: Date | null;
}): ContainerRef {
  return {
    id: c.id, code: c.code,
    status: c.status as ContainerRef["status"],
    loadingDate: iso(c.loadingDate),
    expectedArrivalDate: iso(c.expectedArrivalDate),
  };
}

/* eslint-disable @typescript-eslint/no-explicit-any -- Prisma payload shapes vary by include; the fields read here are guaranteed by REQUIREMENT_*_INCLUDE */
function base(r: any) {
  const quantities = breakdown(r);
  return {
    id: r.id,
    status: r.status as RequirementListItem["status"],
    fulfilmentStatus: fulfilmentStatus(r),
    productId: r.productId,
    product: serializeProduct(r.product),
    quantities,
    requestedDate: r.requestedDate.toISOString(),
    neededByDate: r.neededByDate.toISOString(),
    createdById: r.createdById,
    createdBy: person(r.createdBy),
    containers: [
      ...new Map(
        r.allocations.map((a: any) => [a.container.id, serializeContainerRef(a.container)])
      ).values(),
    ] as ContainerRef[],
  };
}

export function serializeRequirementListItem(r: any): RequirementListItem {
  return { ...base(r), remarkCount: r._count.remarks, photoCount: r._count.photos };
}

export function serializeRequirementDetail(r: any): RequirementDetail {
  return {
    ...base(r),
    rejectionReason: r.rejectionReason,
    rejectedAt: iso(r.rejectedAt),
    rejectedBy: r.rejectedBy ? person(r.rejectedBy) : null,
    withdrawnAt: iso(r.withdrawnAt),
    withdrawnBy: r.withdrawnBy ? person(r.withdrawnBy) : null,
    procurements: r.procurements.map(
      (p: any): Procurement => ({
        id: p.id, qty: p.qty, confirmedBy: person(p.confirmedBy),
        confirmedAt: p.confirmedAt.toISOString(), notes: p.notes ?? null,
      })
    ),
    allocations: r.allocations.map(
      (a: any): Allocation => ({
        id: a.id, qty: a.qty, containerId: a.containerId,
        container: serializeContainerRef(a.container),
        allocatedBy: person(a.allocatedBy),
        allocatedAt: a.allocatedAt.toISOString(),
        receivedQty: a.receipts.reduce((s: number, x: any) => s + x.qty, 0),
      })
    ),
    remarks: r.remarks
      .slice()
      .sort((a: any, b: any) => b.createdAt.getTime() - a.createdAt.getTime())
      .map(
        (m: any): Remark => ({
          id: m.id, requirementId: m.requirementId, body: m.body,
          authorId: m.authorId, author: person(m.author),
          createdAt: m.createdAt.toISOString(), updatedAt: m.updatedAt.toISOString(),
        })
      ),
    photos: r.photos
      .slice()
      .sort((a: any, b: any) => b.createdAt.getTime() - a.createdAt.getTime())
      .map(
        (p: any): Photo => ({
          id: p.id, requirementId: p.requirementId, url: p.url,
          source: p.source as Photo["source"],
          uploadedById: p.uploadedById, uploadedBy: person(p.uploadedBy),
          createdAt: p.createdAt.toISOString(),
        })
      ),
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export const PRODUCT_INCLUDE = { family: true, identifiers: true } as const;

const QUANTITY_RELATIONS = {
  procurements: { include: { confirmedBy: { select: { id: true, name: true } } } },
  allocations: {
    include: {
      container: true,
      allocatedBy: { select: { id: true, name: true } },
      receipts: true,
    },
  },
} as const;

export const REQUIREMENT_LIST_INCLUDE = {
  product: { include: PRODUCT_INCLUDE },
  createdBy: { select: { id: true, name: true } },
  ...QUANTITY_RELATIONS,
  _count: { select: { remarks: true, photos: true } },
} as const;

export const REQUIREMENT_DETAIL_INCLUDE = {
  product: { include: PRODUCT_INCLUDE },
  createdBy: { select: { id: true, name: true } },
  rejectedBy: { select: { id: true, name: true } },
  withdrawnBy: { select: { id: true, name: true } },
  ...QUANTITY_RELATIONS,
  remarks: { include: { author: { select: { id: true, name: true } } } },
  photos: { include: { uploadedBy: { select: { id: true, name: true } } } },
} as const;

export { num };
