"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ProductPicker from "@/components/ProductPicker";
import OrderIdentifierFields from "@/components/OrderIdentifierFields";
import CurrencyPreview from "@/components/CurrencyPreview";
import { inputClass, labelClass, primaryButtonClass } from "@/lib/formStyles";
import type { ProductFamily, ProductSelection } from "@/lib/types";

export default function NewOrderForm() {
  const router = useRouter();
  const [selection, setSelection] = useState<ProductSelection | null>(null);
  const [families, setFamilies] = useState<ProductFamily[]>([]);
  const [qty, setQty] = useState("");
  const [priceInr, setPriceInr] = useState("");
  const [neededByDate, setNeededByDate] = useState("");
  const [remarks, setRemarks] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/product-families")
      .then((res) => (res.ok ? res.json() : []))
      .then(setFamilies);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!selection) {
      setError("Pick or describe the product first");
      return;
    }
    if (selection.kind === "new") {
      const hasIdentifier = Object.entries(selection.draft).some(
        ([key, val]) => key !== "name" && key !== "familyId" && val
      );
      if (!hasIdentifier && !imageFile) {
        setError("Provide at least one identifier, or attach a photo");
        return;
      }
    }

    setSubmitting(true);

    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        qty: Number(qty),
        requestedPriceInr: Number(priceInr),
        neededByDate,
        remarks: remarks.trim() || undefined,
        hasImage: !!imageFile,
        ...(selection.kind === "existing"
          ? { productId: selection.product.id }
          : { product: selection.draft }),
      }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error || "Failed to create order");
      setSubmitting(false);
      return;
    }

    const order = await res.json();

    if (imageFile) {
      const formData = new FormData();
      formData.set("file", imageFile);
      await fetch(`/api/orders/${order.id}/photos`, { method: "POST", body: formData }).catch(() => {});
    }

    setSubmitting(false);
    router.push("/");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="rounded-2xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-white/5">
        <h2 className="mb-3 font-semibold">Product</h2>
        <ProductPicker value={selection} onChange={setSelection} />
        {selection?.kind === "new" && (
          <div className="mt-3">
            <OrderIdentifierFields
              draft={selection.draft}
              onChange={(draft) => setSelection({ kind: "new", draft })}
              families={families}
              hasImage={!!imageFile}
            />
          </div>
        )}

        <div className="mt-3">
          <label className={labelClass}>Product photo (optional)</label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
            className="text-sm"
          />
        </div>
      </div>

      <div className="rounded-2xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-white/5">
        <h2 className="mb-3 font-semibold">Order details</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass} htmlFor="qty">
              Required quantity
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
            <label className={labelClass} htmlFor="price">
              Desired price (INR)
            </label>
            <input
              id="price"
              type="number"
              min={0.01}
              step="0.01"
              required
              value={priceInr}
              onChange={(e) => setPriceInr(e.target.value)}
              className={inputClass}
            />
            <CurrencyPreview amount={Number(priceInr)} from="INR" to="CNY" />
          </div>
        </div>

        <div className="mt-3">
          <label className={labelClass} htmlFor="neededByDate">
            Required-by date
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

        <div className="mt-3">
          <label className={labelClass} htmlFor="remarks">
            Remarks / comments
          </label>
          <textarea
            id="remarks"
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="Anything relevant about this request…"
            className={`${inputClass} min-h-20`}
          />
        </div>
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <button type="submit" disabled={submitting} className={primaryButtonClass}>
        {submitting ? "Submitting…" : "Submit Request"}
      </button>
    </form>
  );
}
