"use client";

import { useCallback, useEffect, useState } from "react";
import type { Product, ProductFamily } from "@/lib/types";
import ProductFamilyManager from "@/components/ProductFamilyManager";
import ProductManager from "@/components/ProductManager";

export default function ProductsPageClient({ canEdit }: { canEdit: boolean }) {
  const [families, setFamilies] = useState<ProductFamily[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async (currentSearch: string) => {
    const [familiesRes, productsRes] = await Promise.all([
      fetch("/api/product-families"),
      fetch(`/api/products${currentSearch ? `?search=${encodeURIComponent(currentSearch)}` : ""}`),
    ]);
    if (familiesRes.ok) setFamilies(await familiesRes.json());
    if (productsRes.ok) setProducts(await productsRes.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => refresh(search), search ? 250 : 0);
    return () => clearTimeout(timeout);
  }, [search, refresh]);

  if (loading) {
    return <p className="py-12 text-center text-sm text-black/40 dark:text-white/40">Loading…</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <ProductFamilyManager families={families} canEdit={canEdit} onChange={() => refresh(search)} />
      <ProductManager
        products={products}
        families={families}
        canEdit={canEdit}
        search={search}
        onSearchChange={setSearch}
        onChange={() => refresh(search)}
      />
    </div>
  );
}
