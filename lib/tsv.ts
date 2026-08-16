import type { OrderListItem } from "@/lib/types";

const HEADERS = [
  "Status",
  "Product Name",
  "MASKU",
  "KMW ID",
  "QTY Requested",
  "Requested Price (INR)",
  "Requested Price (CNY)",
  "Needed By Date",
  "Container",
  "Expected Arrival",
  "Requested Date",
];

const TERMINAL_STATUSES = new Set(["CONFIRMED_RECEIVED", "REJECTED", "WITHDRAWN"]);

function formatDate(value: string | null): string {
  if (!value) return "";
  return value.slice(0, 10);
}

/** Everything still active — i.e. not yet completed, rejected, or withdrawn. */
export function ordersToTsv(orders: OrderListItem[]): string {
  const rows = orders
    .filter((o) => !TERMINAL_STATUSES.has(o.status))
    .map((o) =>
      [
        o.status,
        o.product.name,
        o.product.maSku ?? "",
        o.product.kmwId ?? "",
        String(o.qty),
        o.requestedPriceInr.toFixed(2),
        o.requestedPriceCny?.toFixed(2) ?? "",
        formatDate(o.neededByDate),
        o.containerName ?? "",
        formatDate(o.acceptedExpectedArrivalDate),
        formatDate(o.requestedDate),
      ].join("\t")
    );

  return [HEADERS.join("\t"), ...rows].join("\n");
}
