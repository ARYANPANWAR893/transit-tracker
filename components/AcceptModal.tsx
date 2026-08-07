"use client";

import { useState } from "react";
import Modal from "@/components/Modal";
import { inputClass, labelClass, primaryButtonClass } from "@/lib/formStyles";
import type { OrderDetail, OrderListItem } from "@/lib/types";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function AcceptModal({
  order,
  onClose,
  onAccepted,
}: {
  order: OrderListItem | OrderDetail | null;
  onClose: () => void;
  onAccepted: (order: OrderDetail) => void;
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
    if (!order) return;
    setSubmitting(true);
    setError(null);

    const res = await fetch(`/api/orders/${order.id}/accept`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ containerNumber, estArrivalDate }),
    });

    setSubmitting(false);

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error || "Failed to accept order");
      return;
    }

    const updated: OrderDetail = await res.json();
    onAccepted(updated);
    handleClose();
  }

  return (
    <Modal open={!!order} onClose={handleClose} title="Accept Order">
      {order && (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <p className="text-sm text-black/60 dark:text-white/60">
            {order.product.name} · MA {order.product.maSku}
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

          <button type="submit" disabled={submitting} className={`mt-2 w-full ${primaryButtonClass}`}>
            {submitting ? "Accepting…" : "Accept"}
          </button>
        </form>
      )}
    </Modal>
  );
}
