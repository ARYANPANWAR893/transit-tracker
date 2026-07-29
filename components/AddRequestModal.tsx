"use client";

import { useState } from "react";
import Modal from "@/components/Modal";
import type { Shipment } from "@/lib/types";

const inputClass =
  "w-full rounded-lg border border-black/15 bg-transparent px-3 py-2.5 text-base outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/40";
const labelClass = "mb-1 block text-sm font-medium";

export default function AddRequestModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (shipment: Shipment) => void;
}) {
  const [productName, setProductName] = useState("");
  const [sku, setSku] = useState("");
  const [asin, setAsin] = useState("");
  const [qty, setQty] = useState("");
  const [neededByDate, setNeededByDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setProductName("");
    setSku("");
    setAsin("");
    setQty("");
    setNeededByDate("");
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/shipments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productName,
        sku,
        asin,
        qty: Number(qty),
        neededByDate,
      }),
    });

    setSubmitting(false);

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error || "Failed to create request");
      return;
    }

    const shipment: Shipment = await res.json();
    onCreated(shipment);
    reset();
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="New Request">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div>
          <label className={labelClass} htmlFor="productName">
            Product name
          </label>
          <input
            id="productName"
            required
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
            className={inputClass}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass} htmlFor="sku">
              SKU
            </label>
            <input
              id="sku"
              required
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="asin">
              ASIN
            </label>
            <input
              id="asin"
              required
              value={asin}
              onChange={(e) => setAsin(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>

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

        <button
          type="submit"
          disabled={submitting}
          className="mt-2 w-full rounded-lg bg-black px-4 py-2.5 text-base font-medium text-white disabled:opacity-40 dark:bg-white dark:text-black"
        >
          {submitting ? "Adding…" : "Add Request"}
        </button>
      </form>
    </Modal>
  );
}
