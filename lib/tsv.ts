import type { Shipment } from "@/lib/types";

const HEADERS = [
  "Container Number",
  "Est. Arrival Date",
  "Final Arrived Date",
  "Product Name",
  "SKU",
  "ASIN",
  "QTY",
  "Requested Date",
  "Needed By Date",
  "Acceptance Date",
];

function formatDate(value: string | null): string {
  if (!value) return "";
  return value.slice(0, 10);
}

export function shipmentsToTsv(shipments: Shipment[]): string {
  const rows = shipments
    .filter((s) => s.status !== "ARRIVED")
    .map((s) =>
      [
        s.containerNumber ?? "",
        formatDate(s.estArrivalDate),
        formatDate(s.finalArrivedDate),
        s.productName,
        s.sku,
        s.asin,
        String(s.qty),
        formatDate(s.requestedDate),
        formatDate(s.neededByDate),
        formatDate(s.acceptanceDate),
      ].join("\t")
    );

  return [HEADERS.join("\t"), ...rows].join("\n");
}
