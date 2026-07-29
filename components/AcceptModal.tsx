"use client";

import { useState } from "react";
import Modal from "@/components/Modal";
import type { Shipment } from "@/lib/types";

const inputClass =
  "w-full rounded-lg border border-black/15 bg-transparent px-3 py-2.5 text-base outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/40";
const labelClass = "mb-1 block text-sm font-medium";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function AcceptModal({
  shipment,
  onClose,
  onAccepted,
}: {
  shipment: Shipment | null;
  onClose: () => void;
  onAccepted: (shipment: Shipment) => void;
}) {
  const [containerNumber, setContainerNumber] = useState("");
  const [estArrivalDate, setEstArrivalDate] = useState(today());
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function handleClose() {
    setContainerNumber("");
    setEstArrivalDate(today());
    setError(null);
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!shipment) return;
    setSubmitting(true);
    setError(null);

    const res = await fetch(`/api/shipments/${shipment.id}/accept`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ containerNumber, estArrivalDate }),
    });

    setSubmitting(false);

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error || "Failed to accept request");
      return;
    }

    const updated: Shipment = await res.json();
    onAccepted(updated);
    handleClose();
  }

  return (
    <Modal open={!!shipment} onClose={handleClose} title="Accept Request">
      {shipment && (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <p className="text-sm text-black/60 dark:text-white/60">
            {shipment.productName} · SKU {shipment.sku}
          </p>

          <div>
            <label className={labelClass} htmlFor="containerNumber">
              Container number
            </label>
            <input
              id="containerNumber"
              required
              autoFocus
              value={containerNumber}
              onChange={(e) => setContainerNumber(e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="estArrivalDate">
              Est. arrival date
            </label>
            <input
              id="estArrivalDate"
              type="date"
              required
              value={estArrivalDate}
              onChange={(e) => setEstArrivalDate(e.target.value)}
              className={inputClass}
            />
          </div>

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="mt-2 w-full rounded-lg bg-black px-4 py-2.5 text-base font-medium text-white disabled:opacity-40 dark:bg-white dark:text-black"
          >
            {submitting ? "Accepting…" : "Accept"}
          </button>
        </form>
      )}
    </Modal>
  );
}
