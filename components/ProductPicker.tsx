"use client";

import { useEffect, useMemo, useState } from "react";
import type { Product, ProductFamily, ProductSelection } from "@/lib/types";
import { inputClass, labelClass } from "@/lib/formStyles";

export default function ProductPicker({
  value,
  onChange,
}: {
  value: ProductSelection | null;
  onChange: (selection: ProductSelection | null) => void;
}) {
  const [products, setProducts] = useState<Product[]>([]);
  const [families, setFamilies] = useState<ProductFamily[]>([]);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newMaSku, setNewMaSku] = useState("");
  const [newKmSku, setNewKmSku] = useState("");
  const [newFamilyId, setNewFamilyId] = useState("");

  useEffect(() => {
    fetch("/api/products")
      .then((res) => (res.ok ? res.json() : []))
      .then(setProducts);
    fetch("/api/product-families")
      .then((res) => (res.ok ? res.json() : []))
      .then(setFamilies);
  }, []);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products.slice(0, 8);
    return products
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.maSku.toLowerCase().includes(q) ||
          p.kmSku.toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [products, query]);

  function reset() {
    setQuery("");
    setOpen(true);
    setCreating(false);
    setNewMaSku("");
    setNewKmSku("");
    setNewFamilyId("");
  }

  function handleConfirmNew() {
    if (!query.trim() || !newMaSku.trim() || !newKmSku.trim()) return;
    onChange({
      kind: "new",
      name: query.trim(),
      maSku: newMaSku.trim(),
      kmSku: newKmSku.trim(),
      familyId: newFamilyId || null,
    });
    setOpen(false);
    setCreating(false);
  }

  if (value) {
    const label =
      value.kind === "existing"
        ? { name: value.product.name, maSku: value.product.maSku, tag: null }
        : { name: value.name, maSku: value.maSku, tag: "New" };

    return (
      <div>
        <label className={labelClass}>Product</label>
        <div className="flex items-center justify-between rounded-lg border border-black/15 px-3 py-2.5 text-sm dark:border-white/20">
          <span>
            {label.tag && (
              <span className="mr-1.5 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-400/15 dark:text-amber-300">
                {label.tag}
              </span>
            )}
            {label.name} <span className="text-black/40 dark:text-white/40">({label.maSku})</span>
          </span>
          <button
            type="button"
            onClick={() => {
              onChange(null);
              reset();
            }}
            className="text-black/50 hover:text-black dark:text-white/50 dark:hover:text-white"
          >
            Change
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <label className={labelClass}>Product</label>
      <input
        autoFocus
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setCreating(false);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Search by name, MA SKU, or KM SKU"
        className={inputClass}
      />
      {open && !creating && (
        <ul className="absolute z-10 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-black/10 bg-white shadow-lg dark:border-white/10 dark:bg-[#111316]">
          {matches.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => {
                  onChange({ kind: "existing", product: p });
                  setOpen(false);
                }}
                className="block w-full px-3 py-2 text-left text-sm hover:bg-black/5 dark:hover:bg-white/10"
              >
                {p.name}{" "}
                <span className="text-black/40 dark:text-white/40">
                  · MA {p.maSku} · KM {p.kmSku}
                </span>
              </button>
            </li>
          ))}
          {matches.length === 0 && (
            <li className="px-3 py-2 text-sm text-black/40 dark:text-white/40">No products match.</li>
          )}
          {query.trim() && (
            <li className="border-t border-black/10 dark:border-white/10">
              <button
                type="button"
                onClick={() => setCreating(true)}
                className="block w-full px-3 py-2 text-left text-sm font-medium text-black hover:bg-black/5 dark:text-white dark:hover:bg-white/10"
              >
                + Create &quot;{query.trim()}&quot; as a new product
              </button>
            </li>
          )}
        </ul>
      )}
      {open && creating && (
        <div className="absolute z-10 mt-1 w-full rounded-lg border border-black/10 bg-white p-3 shadow-lg dark:border-white/10 dark:bg-[#111316]">
          <p className="mb-2 text-sm font-medium">New product: {query.trim()}</p>
          <div className="mb-2 grid grid-cols-2 gap-2">
            <input
              autoFocus
              value={newMaSku}
              onChange={(e) => setNewMaSku(e.target.value)}
              placeholder="MA SKU"
              className={inputClass}
            />
            <input
              value={newKmSku}
              onChange={(e) => setNewKmSku(e.target.value)}
              placeholder="KM SKU"
              className={inputClass}
            />
          </div>
          <select
            value={newFamilyId}
            onChange={(e) => setNewFamilyId(e.target.value)}
            className={`${inputClass} mb-2`}
          >
            <option value="">Unassigned family</option>
            {families.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleConfirmNew}
              disabled={!newMaSku.trim() || !newKmSku.trim()}
              className="rounded-lg bg-black px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40 dark:bg-white dark:text-black"
            >
              Use this product
            </button>
            <button
              type="button"
              onClick={() => setCreating(false)}
              className="text-sm text-black/50 dark:text-white/50"
            >
              Back
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
