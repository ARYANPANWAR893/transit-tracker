"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ProductPicker from "@/components/ProductPicker";
import ProductIdentifierFields from "@/components/ProductIdentifierFields";
import { inputClass, labelClass, primaryButtonClass } from "@/lib/formStyles";
import type { ProductFamily, ProductSelection } from "@/lib/types";

export default function NewRequirementForm() {
  const router = useRouter();
  const [selection, setSelection] = useState<ProductSelection | null>(null);
  const [families, setFamilies] = useState<ProductFamily[]>([]);
  const [requiredQty, setRequiredQty] = useState("");
  const [neededByDate, setNeededByDate] = useState("");
  const [remarks, setRemarks] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/product-families").then((r) => (r.ok ? r.json() : [])).then(setFamilies);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!selection) return setError("Pick or describe the product first");
    if (selection.kind === "new" && selection.draft.identifiers.length === 0 && !imageFile) {
      return setError("Add at least one identifier, or attach a photo");
    }

    setSubmitting(true);
    const res = await fetch("/api/requirements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requiredQty: Number(requiredQty),
        neededByDate,
        remarks: remarks.trim() || undefined,
        hasImage: !!imageFile,
        ...(selection.kind === "existing" ? { productId: selection.product.id } : { product: selection.draft }),
      }),
    });

    if (!res.ok) {
      setError((await res.json().catch(() => null))?.error || "Couldn't create the requirement");
      setSubmitting(false);
      return;
    }

    const requirement = await res.json();
    if (imageFile) {
      const formData = new FormData();
      formData.set("file", imageFile);
      await fetch(`/api/requirements/${requirement.id}/photos`, { method: "POST", body: formData }).catch(() => {});
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
            <ProductIdentifierFields
              draft={selection.draft}
              onChange={(draft) => setSelection({ kind: "new", draft })}
              families={families}
              hasImage={!!imageFile}
            />
          </div>
        )}
        <div className="mt-3">
          <label className={labelClass}>Reference photo (optional)</label>
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
        <h2 className="mb-3 font-semibold">Requirement</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor="qty">Quantity required</label>
            <input
              id="qty" type="number" min={1} required
              value={requiredQty} onChange={(e) => setRequiredQty(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="neededByDate">Needed by</label>
            <input
              id="neededByDate" type="date" required
              value={neededByDate} onChange={(e) => setNeededByDate(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>
        <div className="mt-3">
          <label className={labelClass} htmlFor="remarks">Remarks (optional)</label>
          <textarea
            id="remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)}
            placeholder="Anything relevant about this requirement…"
            className={`${inputClass} min-h-20`}
          />
        </div>
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <button type="submit" disabled={submitting} className={primaryButtonClass}>
        {submitting ? "Submitting…" : "Raise Requirement"}
      </button>
    </form>
  );
}
