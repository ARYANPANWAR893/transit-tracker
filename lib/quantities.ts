/**
 * The single source of truth for every quantity figure in the app.
 *
 * A requirement's quantity can be spread across several containers, so its
 * progress is a combination of quantity states rather than one linear status.
 * Everything here is DERIVED on read -- nothing is stored -- so the numbers can
 * never drift from the records they describe.
 */

import type { ContainerStatus } from "@/app/generated/prisma/client";

/** Containers whose contents are on the water (allocated and gone, not yet received). */
const IN_TRANSIT_STATUSES: ContainerStatus[] = ["LOADED", "IN_TRANSIT"];

export type QuantityBreakdown = {
  required: number;
  procured: number;
  allocated: number;
  inTransit: number;
  received: number;
  /** Still to be procured -- the gap Anish works from. */
  outstanding: number;
};

/**
 * Derived fulfilment state. Distinct from Requirement.status, which only holds
 * the states a human explicitly decided (requested / rejected / withdrawn).
 */
export type FulfilmentStatus =
  | "REJECTED"
  | "WITHDRAWN"
  | "REQUESTED"
  | "PROCUREMENT_CONFIRMED"
  | "ALLOCATED"
  | "PARTIALLY_SHIPPED"
  | "FULLY_SHIPPED"
  | "PARTIALLY_RECEIVED"
  | "RECEIVED";

type RequirementLike = {
  status: string;
  requiredQty: number;
  procurements: { qty: number }[];
  allocations: { qty: number; container: { status: ContainerStatus }; receipts: { qty: number }[] }[];
};

const sum = (ns: number[]) => ns.reduce((a, b) => a + b, 0);

export function breakdown(requirement: RequirementLike): QuantityBreakdown {
  const required = requirement.requiredQty;
  const procured = sum(requirement.procurements.map((p) => p.qty));
  const allocated = sum(requirement.allocations.map((a) => a.qty));
  const inTransit = sum(
    requirement.allocations.filter((a) => IN_TRANSIT_STATUSES.includes(a.container.status)).map((a) => a.qty)
  );
  const received = sum(requirement.allocations.flatMap((a) => a.receipts.map((r) => r.qty)));

  return {
    required,
    procured,
    allocated,
    inTransit,
    received,
    outstanding: Math.max(0, required - procured),
  };
}

export function fulfilmentStatus(requirement: RequirementLike): FulfilmentStatus {
  if (requirement.status === "REJECTED") return "REJECTED";
  if (requirement.status === "WITHDRAWN") return "WITHDRAWN";

  const q = breakdown(requirement);
  if (q.received > 0) return q.received >= q.required ? "RECEIVED" : "PARTIALLY_RECEIVED";
  if (q.inTransit > 0) return q.inTransit >= q.required ? "FULLY_SHIPPED" : "PARTIALLY_SHIPPED";
  if (q.allocated > 0) return "ALLOCATED";
  if (q.procured > 0) return "PROCUREMENT_CONFIRMED";
  return "REQUESTED";
}

/** Roll several requirements for the same product into one set of figures. */
export function aggregate(requirements: RequirementLike[]): QuantityBreakdown {
  const parts = requirements
    .filter((r) => r.status !== "REJECTED" && r.status !== "WITHDRAWN")
    .map(breakdown);
  return {
    required: sum(parts.map((p) => p.required)),
    procured: sum(parts.map((p) => p.procured)),
    allocated: sum(parts.map((p) => p.allocated)),
    inTransit: sum(parts.map((p) => p.inTransit)),
    received: sum(parts.map((p) => p.received)),
    outstanding: sum(parts.map((p) => p.outstanding)),
  };
}

/** Include enough relations for breakdown()/fulfilmentStatus() to be correct. */
export const QUANTITY_INCLUDE = {
  procurements: { select: { qty: true } },
  allocations: {
    select: { qty: true, container: { select: { status: true } }, receipts: { select: { qty: true } } },
  },
} as const;
