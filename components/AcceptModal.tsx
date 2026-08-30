"use client";

import { useState } from "react";
import Modal from "@/components/Modal";
import CurrencyPreview from "@/components/CurrencyPreview";
import { inputClass, labelClass, primaryButtonClass } from "@/lib/formStyles";
import type { OrderDetail, OrderListItem } from "@/lib/types";

export default function AcceptModal({
  order,
  onClose,
  onAccepted,
}: {
  order: OrderListItem | OrderDetail | null;
  onClose: () => void;
  onAccepted: (order: OrderDetail) => void;
}) {
  const [acceptedQty, setAcceptedQty] = useState("");
  const [acceptedPriceCny, setAcceptedPriceCny] = useState("");
  const [expectedArrivalDate, setExpectedArrivalDate] = useState("");
  const [remarks, setRemarks] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function handleClose() {
    setAcceptedQty("");
    setAcceptedPriceCny("");
    setExpectedArrivalDate("");
    setRemarks("");
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
      body: JSON.stringify({
        acceptedQty: Number(acceptedQty),
        acceptedPriceCny: Number(acceptedPriceCny),
        acceptedExpectedArrivalDate: expectedArrivalDate,
        remarks: remarks.trim() || undefined,
      }),
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
            {order.product.name} · requested {order.qty}
            {order.requestedPriceInr !== null && ` at ₹${order.requestedPriceInr.toLocaleString()}`}
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass} htmlFor="acceptedQty">
                Quantity accepted
              </label>
              <input
                id="acceptedQty"
                type="number"
                min={1}
                required
                autoFocus
                value={acceptedQty}
                onChange={(e) => setAcceptedQty(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="acceptedPriceCny">
                Accepted price (CNY)
              </label>
              <input
                id="acceptedPriceCny"
                type="number"
                min={0.01}
                step="0.01"
                required
                value={acceptedPriceCny}
                onChange={(e) => setAcceptedPriceCny(e.target.value)}
                className={inputClass}
              />
              <CurrencyPreview amount={Number(acceptedPriceCny)} from="CNY" to="INR" />
            </div>
          </div>

          <div>
            <label className={labelClass} htmlFor="expectedArrivalDate">
              Expected arrival date
            </label>
            <input
              id="expectedArrivalDate"
              type="date"
              required
              value={expectedArrivalDate}
              onChange={(e) => setExpectedArrivalDate(e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="acceptRemarks">
              Remarks (optional)
            </label>
            <textarea
              id="acceptRemarks"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className={`${inputClass} min-h-16`}
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
