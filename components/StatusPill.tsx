import type { OrderStatus } from "@/lib/types";

const STATUS_STYLES: Record<OrderStatus, string> = {
  DRAFT: "bg-black/10 text-black/60 dark:bg-white/10 dark:text-white/60",
  REQUESTED: "bg-amber-100 text-amber-800 dark:bg-amber-400/15 dark:text-amber-300",
  ACCEPTED: "bg-blue-100 text-blue-800 dark:bg-blue-400/15 dark:text-blue-300",
  REJECTED: "bg-red-100 text-red-800 dark:bg-red-400/15 dark:text-red-300",
  WITHDRAWN: "bg-black/10 text-black/50 dark:bg-white/10 dark:text-white/50",
  IN_TRANSIT: "bg-purple-100 text-purple-800 dark:bg-purple-400/15 dark:text-purple-300",
  ARRIVED: "bg-teal-100 text-teal-800 dark:bg-teal-400/15 dark:text-teal-300",
  CONFIRMED_RECEIVED: "bg-green-100 text-green-800 dark:bg-green-400/15 dark:text-green-300",
};

const STATUS_LABELS: Record<OrderStatus, string> = {
  DRAFT: "Draft",
  REQUESTED: "Requested",
  ACCEPTED: "Accepted",
  REJECTED: "Rejected",
  WITHDRAWN: "Withdrawn",
  IN_TRANSIT: "In Transit",
  ARRIVED: "Arrived",
  CONFIRMED_RECEIVED: "Confirmed Received",
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
