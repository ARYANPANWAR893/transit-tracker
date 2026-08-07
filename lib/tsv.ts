import type { OrderListItem } from "@/lib/types";

const HEADERS = [
  "Container Number",
  "Est. Arrival Date",
  "Final Arrived Date",
  "Product Name",
  "MA SKU",
  "KM SKU",
  "QTY",
  "Requested Date",
  "Needed By Date",
  "Acceptance Date",
];

function formatDate(value: string | null): string {
  if (!value) return "";
  return value.slice(0, 10);
}

export function ordersToTsv(orders: OrderListItem[]): string {
  const rows = orders
    .filter((o) => o.status !== "ARRIVED")
    .map((o) =>
      [
        o.containerNumber ?? "",
        formatDate(o.estArrivalDate),
        formatDate(o.finalArrivedDate),
        o.product.name,
        o.product.maSku,
        o.product.kmSku,
        String(o.qty),
        formatDate(o.requestedDate),
        formatDate(o.neededByDate),
        formatDate(o.acceptanceDate),
      ].join("\t")
    );

  return [HEADERS.join("\t"), ...rows].join("\n");
}
