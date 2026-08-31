import type { RequirementListItem } from "@/lib/types";
import { FULFILMENT_LABELS } from "@/lib/types";

const HEADERS = [
  "Status", "Product", "Identifiers", "Required", "Procured", "Allocated",
  "In Transit", "Received", "Outstanding", "Needed By", "Containers", "Requested",
];

const TERMINAL = new Set(["RECEIVED", "REJECTED", "WITHDRAWN"]);
const date = (v: string | null) => (v ? v.slice(0, 10) : "");

/** Everything still moving -- not yet fully received, rejected or withdrawn. */
export function requirementsToTsv(requirements: RequirementListItem[]): string {
  const rows = requirements
    .filter((r) => !TERMINAL.has(r.fulfilmentStatus))
    .map((r) =>
      [
        FULFILMENT_LABELS[r.fulfilmentStatus],
        r.product.name,
        r.product.identifiers.map((i) => i.value).join(" / "),
        String(r.quantities.required),
        String(r.quantities.procured),
        String(r.quantities.allocated),
        String(r.quantities.inTransit),
        String(r.quantities.received),
        String(r.quantities.outstanding),
        date(r.neededByDate),
        r.containers.map((c) => c.code).join(" / "),
        date(r.requestedDate),
      ].join("\t")
    );
  return [HEADERS.join("\t"), ...rows].join("\n");
}
