import type { OrderStatus } from "@/lib/types";

const STATUS_STYLES: Record<OrderStatus, string> = {
  REQUESTED: "bg-amber-100 text-amber-800 dark:bg-amber-400/15 dark:text-amber-300",
  ACCEPTED: "bg-blue-100 text-blue-800 dark:bg-blue-400/15 dark:text-blue-300",
  PARTIALLY_ARRIVED: "bg-purple-100 text-purple-800 dark:bg-purple-400/15 dark:text-purple-300",
  ARRIVED: "bg-green-100 text-green-800 dark:bg-green-400/15 dark:text-green-300",
};

const STATUS_LABELS: Record<OrderStatus, string> = {
  REQUESTED: "Requested",
  ACCEPTED: "Accepted",
  PARTIALLY_ARRIVED: "Partially Arrived",
  ARRIVED: "Arrived",
};

export default function StatusPill({ status }: { status: OrderStatus }) {
  return (
    <span
      className={`shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
