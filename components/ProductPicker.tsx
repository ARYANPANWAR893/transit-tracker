"use client";

import { useEffect, useMemo, useState } from "react";
import type { Product } from "@/lib/types";
import { inputClass, labelClass } from "@/lib/formStyles";

export default function ProductPicker({
  value,
  onChange,
}: {
  value: Product | null;
  onChange: (product: Product) => void;
}) {
  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetch("/api/products")
      .then((res) => (res.ok ? res.json() : []))
      .then(setProducts);
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

  return (
    <div className="relative">
      <label className={labelClass}>Product</label>
      {value ? (
        <div className="flex items-center justify-between rounded-lg border border-black/15 px-3 py-2.5 text-sm dark:border-white/20">
          <span>
            {value.name} <span className="text-black/40 dark:text-white/40">({value.maSku})</span>
          </span>
          <button
            type="button"
            onClick={() => {
              onChange(null as unknown as Product);
              setQuery("");
              setOpen(true);
            }}
            className="text-black/50 hover:text-black dark:text-white/50 dark:hover:text-white"
          >
            Change
          </button>
        </div>
      ) : (
        <>
          <input
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder="Search by name, MA SKU, or KM SKU"
            className={inputClass}
          />
          {open && (
            <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-black/10 bg-white shadow-lg dark:border-white/10 dark:bg-[#111316]">
              {matches.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(p);
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
                <li className="px-3 py-2 text-sm text-black/40 dark:text-white/40">
                  No products match.
                </li>
              )}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
