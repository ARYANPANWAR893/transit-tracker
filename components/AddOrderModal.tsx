"use client";

import { useState } from "react";
import Modal from "@/components/Modal";
import ProductPicker from "@/components/ProductPicker";
import { inputClass, labelClass, primaryButtonClass } from "@/lib/formStyles";
import type { OrderListItem, Product } from "@/lib/types";

export default function AddOrderModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (order: OrderListItem) => void;
}) {
  const [product, setProduct] = useState<Product | null>(null);
  const [qty, setQty] = useState("");
  const [neededByDate, setNeededByDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setProduct(null);
    setQty("");
    setNeededByDate("");
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!product) {
      setError("Pick a product");
      return;
    }
    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId: product.id, qty: Number(qty), neededByDate }),
    });

    setSubmitting(false);

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error || "Failed to create order");
      return;
    }

    const order: OrderListItem = await res.json();
    onCreated(order);
    reset();
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="New Order">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <ProductPicker value={product} onChange={setProduct} />

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass} htmlFor="qty">
              QTY
            </label>
            <input
              id="qty"
              type="number"
              min={1}
              required
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="neededByDate">
              Needed by date
            </label>
            <input
              id="neededByDate"
              type="date"
              required
              value={neededByDate}
              onChange={(e) => setNeededByDate(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <button type="submit" disabled={submitting} className={`mt-2 w-full ${primaryButtonClass}`}>
          {submitting ? "Adding…" : "Add Order"}
        </button>
      </form>
    </Modal>
  );
}
