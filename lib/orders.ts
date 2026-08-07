import type { OrderStatus } from "@/app/generated/prisma/client";

type ArrivalLike = { qty: number; arrivedDate: Date };

/** Sums arrivals and figures out which arrival (if any) completed fulfillment. */
export function computeArrivalTotals(qty: number, arrivals: ArrivalLike[]) {
  const qtyReceived = arrivals.reduce((sum, a) => sum + a.qty, 0);
  let finalArrivedDate: Date | null = null;

  if (qtyReceived >= qty && qty > 0) {
    const sorted = [...arrivals].sort((a, b) => a.arrivedDate.getTime() - b.arrivedDate.getTime());
    let cumulative = 0;
    for (const arrival of sorted) {
      cumulative += arrival.qty;
      if (cumulative >= qty) {
        finalArrivedDate = arrival.arrivedDate;
        break;
      }
    }
  }

  return { qtyReceived, finalArrivedDate };
}

/** Derives the order's status from qty vs. what has arrived, and whether it's been accepted. */
export function computeOrderStatus(
  qty: number,
  qtyReceived: number,
  isAccepted: boolean
): OrderStatus {
  if (qty > 0 && qtyReceived >= qty) return "ARRIVED";
  if (qtyReceived > 0) return "PARTIALLY_ARRIVED";
  return isAccepted ? "ACCEPTED" : "REQUESTED";
}
