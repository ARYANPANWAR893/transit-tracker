"use client";

import { useState } from "react";
import Modal from "@/components/Modal";
import { inputClass, labelClass, primaryButtonClass } from "@/lib/formStyles";
import type { OrderDetail } from "@/lib/types";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function AddArrivalModal({
  order,
  onClose,
  onAdded,
}: {
  order: OrderDetail | null;
  onClose: () => void;
  onAdded: (order: OrderDetail) => void;
}) {
  const [qty, setQty] = useState("");
  const [arrivedDate, setArrivedDate] = useState(today());
  const [containerNumber, setContainerNumber] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const remaining = order ? order.qty - order.qtyReceived : 0;

  function handleClose() {
    setQty("");
    setArrivedDate(today());
    setContainerNumber("");
    setError(null);
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!order) return;
    setSubmitting(true);
    setError(null);

    const res = await fetch(`/api/orders/${order.id}/arrivals`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ qty: Number(qty), arrivedDate, containerNumber: containerNumber || undefined }),
    });

    setSubmitting(false);

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error || "Failed to record arrival");
      return;
    }

    const updated: OrderDetail = await res.json();
    onAdded(updated);
    handleClose();
  }

  return (
    <Modal open={!!order} onClose={handleClose} title="Record Arrival">
      {order && (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <p className="text-sm text-black/60 dark:text-white/60">
            {order.product.name} — {remaining} of {order.qty} still outstanding
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass} htmlFor="arrivalQty">
                QTY arrived
              </label>
              <input
                id="arrivalQty"
                type="number"
                min={1}
                max={remaining}
                required
                autoFocus
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="arrivedDate">
                Arrival date
              </label>
              <input
                id="arrivedDate"
                type="date"
                required
                value={arrivedDate}
                onChange={(e) => setArrivedDate(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className={labelClass} htmlFor="arrivalContainer">
              Container number <span className="text-black/40 dark:text-white/40">(optional)</span>
            </label>
            <input
              id="arrivalContainer"
              value={containerNumber}
              onChange={(e) => setContainerNumber(e.target.value)}
              placeholder={order.containerNumber || ""}
              className={inputClass}
            />
          </div>

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          <button type="submit" disabled={submitting} className={`mt-2 w-full ${primaryButtonClass}`}>
            {submitting ? "Recording…" : "Record Arrival"}
          </button>
        </form>
      )}
    </Modal>
  );
}
