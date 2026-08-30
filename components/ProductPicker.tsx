"use client";

import { useEffect, useMemo, useState } from "react";
import type { Product, ProductSelection } from "@/lib/types";
import { inputClass, labelClass } from "@/lib/formStyles";

function identifierSummary(p: Product): string {
  const bits = [
    p.maSku && `MASKU ${p.maSku}`,
    p.kmwId && `KMW ${p.kmwId}`,
    p.amazonSku && `Amazon SKU ${p.amazonSku}`,
    p.amazonAsin && `ASIN ${p.amazonAsin}`,
    p.flipkartSku && `Flipkart SKU ${p.flipkartSku}`,
    p.flipkartAsin && `Flipkart ASIN ${p.flipkartAsin}`,
    p.meeshoSku && `Meesho SKU ${p.meeshoSku}`,
    p.meeshoProductId && `Meesho ID ${p.meeshoProductId}`,
  ].filter(Boolean);
  return bits.join(" · ") || "No identifiers on file";
}

export default function ProductPicker({
  value,
  onChange,
}: {
  value: ProductSelection | null;
  onChange: (selection: ProductSelection | null) => void;
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
          [
            p.maSku,
            p.kmwId,
            p.amazonSku,
            p.amazonAsin,
            p.flipkartSku,
            p.flipkartAsin,
            p.meeshoSku,
            p.meeshoProductId,
          ].some((v) => v?.toLowerCase().includes(q))
      )
      .slice(0, 8);
  }, [products, query]);

  function reset() {
    setQuery("");
    setOpen(true);
  }

  if (value?.kind === "existing") {
    return (
      <div>
        <label className={labelClass}>Product</label>
        <div className="flex items-center justify-between rounded-lg border border-black/15 px-3 py-2.5 text-sm dark:border-white/20">
          <span>
            {value.product.name}{" "}
            <span className="text-black/40 dark:text-white/40">({identifierSummary(value.product)})</span>
          </span>
          <button
            type="button"
            onClick={() => {
              onChange(null);
              reset();
            }}
            className="shrink-0 text-black/50 hover:text-black dark:text-white/50 dark:hover:text-white"
          >
            Change
          </button>
        </div>
      </div>
    );
  }

  if (value?.kind === "new") {
    return null; // parent renders the full identifier form for the "new" case
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
        }}
        onFocus={() => setOpen(true)}
        placeholder="Search by name or any identifier"
        className={inputClass}
      />
      {open && (
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
                onChange({
                  kind: "new",
                  draft: {
                    name: query.trim(),
                    amazonSku: null,
                    amazonAsin: null,
                    flipkartSku: null,
                    flipkartAsin: null,
                    meeshoSku: null,
                    meeshoProductId: null,
                    maSku: null,
                    kmwId: null,
                    familyId: null,
                  },
                });
                setOpen(false);
              }}
              className="block w-full px-3 py-2 text-left text-sm font-medium text-black hover:bg-black/5 dark:text-white dark:hover:bg-white/10"
            >
              + This isn&apos;t in the list — describe it manually
            </button>
          </li>
        </ul>
      )}
    </div>
  );
}
