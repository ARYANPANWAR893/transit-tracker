"use client";

import { useState } from "react";
import Link from "next/link";
import type { Product, ProductDraft, ProductFamily } from "@/lib/types";
import { inputClass, primaryButtonClass } from "@/lib/formStyles";
import ProductIdentifierFields from "@/components/ProductIdentifierFields";

const EMPTY_DRAFT: ProductDraft = { name: "", familyId: null, identifiers: [] };

function summary(p: Product): string {
  if (p.identifiers.length === 0) return "—";
  return p.identifiers.map((i) => i.value).join(" · ");
}

export default function ProductManager({
  products, families, canEdit, search, onSearchChange, onChange,
}: {
  products: Product[];
  families: ProductFamily[];
  canEdit: boolean;
  search: string;
  onSearchChange: (v: string) => void;
  onChange: () => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState<ProductDraft>(EMPTY_DRAFT);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const res = await fetch("/api/products", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft),
    });
    setSubmitting(false);
    if (!res.ok) {
      setError((await res.json().catch(() => null))?.error || "Couldn't create the product");
      return;
    }
    setDraft(EMPTY_DRAFT);
    setShowForm(false);
    onChange();
  }

  async function reassign(product: Product, familyId: string) {
    const res = await fetch(`/api/products/${product.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ familyId: familyId || null }),
    });
    if (res.ok) onChange();
  }

  async function handleDelete(product: Product) {
    if (!window.confirm(`Delete "${product.name}"?`)) return;
    const res = await fetch(`/api/products/${product.id}`, { method: "DELETE" });
    if (res.ok) onChange();
    else alert((await res.json().catch(() => null))?.error || "Couldn't delete that product");
  }

  return (
    <div className="rounded-2xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-white/5">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="font-semibold">Products</h2>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={search} onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search name or any code" className={`${inputClass} sm:w-56`}
          />
          {canEdit && (
            <button onClick={() => setShowForm((v) => !v)} className={primaryButtonClass}>
              {showForm ? "Cancel" : "+ Product"}
            </button>
          )}
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="mb-4 rounded-xl border border-black/10 p-3 dark:border-white/10">
          <ProductIdentifierFields draft={draft} onChange={setDraft} families={families} hasImage={false} />
          {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
          <button type="submit" disabled={submitting} className={`${primaryButtonClass} mt-3`}>
            {submitting ? "Adding…" : "Add product"}
          </button>
        </form>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="text-xs uppercase text-black/40 dark:text-white/40">
            <tr>
              <th className="py-1.5 pr-3">Name</th>
              <th className="py-1.5 pr-3">Identifiers</th>
              <th className="py-1.5 pr-3">Family</th>
              {canEdit && <th className="py-1.5" />}
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <tr key={product.id} className="border-t border-black/5 dark:border-white/10">
                <td className="py-1.5 pr-3">
                  <Link href={`/products/${product.id}`} className="font-medium hover:underline">
                    {product.name}
                  </Link>
                </td>
                <td className="py-1.5 pr-3 text-black/60 dark:text-white/60">{summary(product)}</td>
                <td className="py-1.5 pr-3">
                  {canEdit ? (
                    <select
                      value={product.familyId ?? ""}
                      onChange={(e) => reassign(product, e.target.value)}
                      className="rounded-md border border-black/15 bg-transparent px-1.5 py-1 text-sm dark:border-white/20"
                    >
                      <option value="">Unassigned</option>
                      {families.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                    </select>
                  ) : (
                    product.family?.name || "—"
                  )}
                </td>
                {canEdit && (
                  <td className="py-1.5 text-right">
                    <button onClick={() => handleDelete(product)} className="text-red-600 hover:text-red-700 dark:text-red-400">
                      Delete
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {products.length === 0 && (
              <tr>
                <td colSpan={4} className="py-4 text-center text-black/40 dark:text-white/40">No products found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
