"use client";

import { useState } from "react";
import Modal from "@/components/Modal";
import { inputClass, labelClass } from "@/lib/formStyles";
import type { OrderDetail, OrderListItem } from "@/lib/types";

export default function RejectOrderModal({
  order,
  onClose,
  onRejected,
}: {
  order: OrderListItem | OrderDetail | null;
  onClose: () => void;
  onRejected: (order: OrderDetail) => void;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function handleClose() {
    setReason("");
    setError(null);
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!order || !reason.trim()) return;
    setSubmitting(true);
    setError(null);

    const res = await fetch(`/api/orders/${order.id}/reject`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });

    setSubmitting(false);

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error || "Failed to reject order");
      return;
    }

    const updated: OrderDetail = await res.json();
    onRejected(updated);
    handleClose();
  }

  return (
    <Modal open={!!order} onClose={handleClose} title="Reject Order">
      {order && (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <p className="text-sm text-black/60 dark:text-white/60">{order.product.name}</p>

          <div>
            <label className={labelClass} htmlFor="rejectReason">
              Rejection reason <span className="text-red-600 dark:text-red-400">(required)</span>
            </label>
            <textarea
              id="rejectReason"
              required
              autoFocus
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain why this request can't be fulfilled…"
              className={`${inputClass} min-h-20`}
            />
          </div>

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={submitting || !reason.trim()}
            className={`mt-2 w-full rounded-lg bg-red-600 px-4 py-2.5 text-base font-medium text-white disabled:opacity-40 hover:bg-red-700`}
          >
            {submitting ? "Rejecting…" : "Reject"}
          </button>
        </form>
      )}
    </Modal>
  );
}
