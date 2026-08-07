"use client";

import { useState } from "react";
import type { Product, ProductFamily } from "@/lib/types";
import { inputClass, labelClass, primaryButtonClass } from "@/lib/formStyles";

export default function ProductManager({
  products,
  families,
  canEdit,
  search,
  onSearchChange,
  onChange,
}: {
  products: Product[];
  families: ProductFamily[];
  canEdit: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  onChange: () => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [maSku, setMaSku] = useState("");
  const [kmSku, setKmSku] = useState("");
  const [familyId, setFamilyId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function resetForm() {
    setName("");
    setMaSku("");
    setKmSku("");
    setFamilyId("");
    setError(null);
    setShowForm(false);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, maSku, kmSku, familyId: familyId || null }),
    });

    setSubmitting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error || "Failed to create product");
      return;
    }
    resetForm();
    onChange();
  }

  async function handleReassignFamily(product: Product, newFamilyId: string) {
    const res = await fetch(`/api/products/${product.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ familyId: newFamilyId || null }),
    });
    if (res.ok) onChange();
  }

  async function handleDelete(product: Product) {
    if (!window.confirm(`Delete product "${product.name}"?`)) return;
    const res = await fetch(`/api/products/${product.id}`, { method: "DELETE" });
    if (res.ok) {
      onChange();
    } else {
      const body = await res.json().catch(() => null);
      alert(body?.error || "Failed to delete product");
    }
  }

  return (
    <div className="rounded-2xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-white/5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">Products</h2>
        <div className="flex gap-2">
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search name / MA SKU / KM SKU"
            className={`${inputClass} w-56`}
          />
          {canEdit && (
            <button onClick={() => setShowForm((v) => !v)} className={primaryButtonClass}>
              {showForm ? "Cancel" : "+ Product"}
            </button>
          )}
        </div>
      </div>

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="mb-4 grid grid-cols-1 gap-3 rounded-xl border border-black/10 p-3 sm:grid-cols-2 dark:border-white/10"
        >
          <div className="sm:col-span-2">
            <label className={labelClass}>Product name</label>
            <input required value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>MA SKU</label>
            <input required value={maSku} onChange={(e) => setMaSku(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>KM SKU</label>
            <input required value={kmSku} onChange={(e) => setKmSku(e.target.value)} className={inputClass} />
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass}>Family</label>
            <select
              value={familyId}
              onChange={(e) => setFamilyId(e.target.value)}
              className={inputClass}
            >
              <option value="">Unassigned</option>
              {families.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>
          {error && <p className="text-sm text-red-600 sm:col-span-2 dark:text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className={`${primaryButtonClass} sm:col-span-2`}
          >
            {submitting ? "Adding…" : "Add product"}
          </button>
        </form>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="text-xs uppercase text-black/40 dark:text-white/40">
            <tr>
              <th className="py-1.5 pr-3">Name</th>
              <th className="py-1.5 pr-3">MA SKU</th>
              <th className="py-1.5 pr-3">KM SKU</th>
              <th className="py-1.5 pr-3">Family</th>
              {canEdit && <th className="py-1.5"></th>}
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <tr key={product.id} className="border-t border-black/5 dark:border-white/10">
                <td className="py-1.5 pr-3">{product.name}</td>
                <td className="py-1.5 pr-3">{product.maSku}</td>
                <td className="py-1.5 pr-3">{product.kmSku}</td>
                <td className="py-1.5 pr-3">
                  {canEdit ? (
                    <select
                      value={product.familyId ?? ""}
                      onChange={(e) => handleReassignFamily(product, e.target.value)}
                      className="rounded-md border border-black/15 bg-transparent px-1.5 py-1 text-sm dark:border-white/20"
                    >
                      <option value="">Unassigned</option>
                      {families.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    product.family?.name || "—"
                  )}
                </td>
                {canEdit && (
                  <td className="py-1.5 text-right">
                    <button
                      onClick={() => handleDelete(product)}
                      className="text-red-600 hover:text-red-700 dark:text-red-400"
                    >
                      Delete
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {products.length === 0 && (
              <tr>
                <td colSpan={5} className="py-4 text-center text-black/40 dark:text-white/40">
                  No products found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
