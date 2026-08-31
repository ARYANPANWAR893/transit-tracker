"use client";

import { useEffect, useMemo, useState } from "react";
import type { Product, ProductSelection } from "@/lib/types";
import { inputClass, labelClass } from "@/lib/formStyles";

export function identifierSummary(p: Product): string {
  if (p.identifiers.length === 0) return "No identifiers on file";
  return p.identifiers.slice(0, 3).map((i) => i.value).join(" · ") +
    (p.identifiers.length > 3 ? ` +${p.identifiers.length - 3}` : "");
}

export default function ProductPicker({
  value, onChange,
}: {
  value: ProductSelection | null;
  onChange: (selection: ProductSelection | null) => void;
}) {
  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetch("/api/products").then((r) => (r.ok ? r.json() : [])).then(setProducts);
  }, []);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products.slice(0, 8);
    return products
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.identifiers.some((i) => i.value.toLowerCase().includes(q))
      )
      .slice(0, 8);
  }, [products, query]);

  if (value?.kind === "existing") {
    return (
      <div>
        <label className={labelClass}>Product</label>
        <div className="flex items-center justify-between gap-2 rounded-lg border border-black/15 px-3 py-2.5 text-sm dark:border-white/20">
          <span className="min-w-0">
            <span className="font-medium">{value.product.name}</span>{" "}
            <span className="text-black/40 dark:text-white/40">({identifierSummary(value.product)})</span>
          </span>
          <button
            type="button"
            onClick={() => { onChange(null); setQuery(""); setOpen(true); }}
            className="shrink-0 text-black/50 hover:text-black dark:text-white/50 dark:hover:text-white"
          >
            Change
          </button>
        </div>
      </div>
    );
  }

  if (value?.kind === "new") return null; // parent renders the identifier form

  return (
    <div className="relative">
      <label className={labelClass}>Product</label>
      <input
        autoFocus
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder="Search by name or any code"
        className={inputClass}
      />
      {open && (
        <ul className="absolute z-10 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-black/10 bg-white shadow-lg dark:border-white/10 dark:bg-[#111316]">
          {matches.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => { onChange({ kind: "existing", product: p }); setOpen(false); }}
                className="block w-full px-3 py-2 text-left text-sm hover:bg-black/5 dark:hover:bg-white/10"
              >
                {p.name} <span className="text-black/40 dark:text-white/40">· {identifierSummary(p)}</span>
              </button>
            </li>
          ))}
          {matches.length === 0 && (
            <li className="px-3 py-2 text-sm text-black/40 dark:text-white/40">No products match.</li>
          )}
          <li className="border-t border-black/10 dark:border-white/10">
            <button
              type="button"
              onClick={() => {
                onChange({ kind: "new", draft: { name: query.trim(), familyId: null, identifiers: [] } });
                setOpen(false);
              }}
              className="block w-full px-3 py-2 text-left text-sm font-medium text-black hover:bg-black/5 dark:text-white dark:hover:bg-white/10"
            >
              + This isn&apos;t in the list — describe it
            </button>
          </li>
        </ul>
      )}
    </div>
  );
}
