import type { ContainerStatus, FulfilmentStatus } from "@/lib/types";
import { CONTAINER_STATUS_LABELS, FULFILMENT_LABELS } from "@/lib/types";

const base =
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap";

const FULFILMENT_STYLES: Record<FulfilmentStatus, string> = {
  REQUESTED: "bg-amber-100 text-amber-800 dark:bg-amber-400/15 dark:text-amber-300",
  PROCUREMENT_CONFIRMED: "bg-sky-100 text-sky-800 dark:bg-sky-400/15 dark:text-sky-300",
  ALLOCATED: "bg-indigo-100 text-indigo-800 dark:bg-indigo-400/15 dark:text-indigo-300",
  PARTIALLY_SHIPPED: "bg-violet-100 text-violet-800 dark:bg-violet-400/15 dark:text-violet-300",
  FULLY_SHIPPED: "bg-violet-100 text-violet-800 dark:bg-violet-400/15 dark:text-violet-300",
  PARTIALLY_RECEIVED: "bg-teal-100 text-teal-800 dark:bg-teal-400/15 dark:text-teal-300",
  RECEIVED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-400/15 dark:text-emerald-300",
  REJECTED: "bg-red-100 text-red-800 dark:bg-red-400/15 dark:text-red-300",
  WITHDRAWN: "bg-black/10 text-black/60 dark:bg-white/10 dark:text-white/60",
};

const CONTAINER_STYLES: Record<ContainerStatus, string> = {
  CREATED: "bg-black/10 text-black/60 dark:bg-white/10 dark:text-white/60",
  PROCUREMENT: "bg-sky-100 text-sky-800 dark:bg-sky-400/15 dark:text-sky-300",
  READY_FOR_LOADING: "bg-amber-100 text-amber-800 dark:bg-amber-400/15 dark:text-amber-300",
  LOADING: "bg-amber-100 text-amber-800 dark:bg-amber-400/15 dark:text-amber-300",
  LOADED: "bg-indigo-100 text-indigo-800 dark:bg-indigo-400/15 dark:text-indigo-300",
  IN_TRANSIT: "bg-violet-100 text-violet-800 dark:bg-violet-400/15 dark:text-violet-300",
  ARRIVED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-400/15 dark:text-emerald-300",
};

export default function StatusPill({ status }: { status: FulfilmentStatus }) {
  return <span className={`${base} ${FULFILMENT_STYLES[status]}`}>{FULFILMENT_LABELS[status]}</span>;
}

export function ContainerStatusPill({ status }: { status: ContainerStatus }) {
  return <span className={`${base} ${CONTAINER_STYLES[status]}`}>{CONTAINER_STATUS_LABELS[status]}</span>;
}
