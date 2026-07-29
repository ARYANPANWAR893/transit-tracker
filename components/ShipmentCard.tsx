"use client";

import type { Shipment } from "@/lib/types";

const STATUS_STYLES: Record<Shipment["status"], string> = {
  REQUESTED: "bg-amber-100 text-amber-800 dark:bg-amber-400/15 dark:text-amber-300",
  ACCEPTED: "bg-blue-100 text-blue-800 dark:bg-blue-400/15 dark:text-blue-300",
  ARRIVED: "bg-green-100 text-green-800 dark:bg-green-400/15 dark:text-green-300",
};

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-black/40 dark:text-white/40">
        {label}
      </dt>
      <dd className="text-sm">{value}</dd>
    </div>
  );
}

export default function ShipmentCard({
  shipment,
  onAccept,
  onArrive,
  onDelete,
}: {
  shipment: Shipment;
  onAccept: (shipment: Shipment) => void;
  onArrive: (shipment: Shipment) => void;
  onDelete: (shipment: Shipment) => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-black/10 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold leading-tight">{shipment.productName}</h3>
          <p className="text-xs text-black/50 dark:text-white/50">
            SKU {shipment.sku} · ASIN {shipment.asin}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[shipment.status]}`}
        >
          {shipment.status}
        </span>
      </div>

      <dl className="grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-3">
        <Field label="QTY" value={String(shipment.qty)} />
        <Field label="Requested" value={formatDate(shipment.requestedDate)} />
        <Field label="Needed By" value={formatDate(shipment.neededByDate)} />
        {shipment.status !== "REQUESTED" && (
          <Field label="Accepted" value={formatDate(shipment.acceptanceDate)} />
        )}
        {shipment.status !== "REQUESTED" && (
          <>
            <Field label="Container #" value={shipment.containerNumber || "—"} />
            <Field label="Est. Arrival" value={formatDate(shipment.estArrivalDate)} />
          </>
        )}
        {shipment.status === "ARRIVED" && (
          <Field label="Arrived" value={formatDate(shipment.finalArrivedDate)} />
        )}
      </dl>

      <div className="flex flex-wrap gap-2 pt-1">
        {shipment.status === "REQUESTED" && (
          <button
            onClick={() => onAccept(shipment)}
            className="rounded-lg bg-black px-3.5 py-2 text-sm font-medium text-white dark:bg-white dark:text-black"
          >
            Accept
          </button>
        )}
        {shipment.status === "ACCEPTED" && (
          <button
            onClick={() => onArrive(shipment)}
            className="rounded-lg bg-black px-3.5 py-2 text-sm font-medium text-white dark:bg-white dark:text-black"
          >
            Mark Arrived
          </button>
        )}
        <button
          onClick={() => onDelete(shipment)}
          className="rounded-lg px-3.5 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
