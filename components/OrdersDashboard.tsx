"use client";

import { useCallback, useEffect, useState } from "react";
import type { OrderListItem, OrderListResponse, OrderStatus, ProductFamily, PublicUser } from "@/lib/types";
import OrderTable from "@/components/OrderTable";
import OrderCardList from "@/components/OrderCardList";
import OrderDetailDrawer from "@/components/OrderDetailDrawer";
import AddOrderModal from "@/components/AddOrderModal";
import CopyExcelButton from "@/components/CopyExcelButton";
import { inputClass, primaryButtonClass, secondaryButtonClass } from "@/lib/formStyles";

const STATUS_OPTIONS: { value: OrderStatus | ""; label: string }[] = [
  { value: "", label: "All statuses" },
  { value: "REQUESTED", label: "Requested" },
  { value: "ACCEPTED", label: "Accepted" },
  { value: "PARTIALLY_ARRIVED", label: "Partially Arrived" },
  { value: "ARRIVED", label: "Arrived" },
];

export default function OrdersDashboard({ currentUser }: { currentUser: PublicUser }) {
  const [orders, setOrders] = useState<OrderListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const [status, setStatus] = useState<OrderStatus | "">("");
  const [familyId, setFamilyId] = useState("");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const [families, setFamilies] = useState<ProductFamily[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const canEdit = currentUser.role === "ADMIN" || currentUser.role === "EDITOR";

  const refresh = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
      sortBy,
      sortDir,
    });
    if (status) params.set("status", status);
    if (familyId) params.set("familyId", familyId);
    if (search) params.set("search", search);

    const res = await fetch(`/api/orders?${params.toString()}`);
    if (res.ok) {
      const data: OrderListResponse = await res.json();
      setOrders(data.items);
      setTotal(data.total);
    }
    setLoading(false);
  }, [page, sortBy, sortDir, status, familyId, search]);

  useEffect(() => {
    fetch("/api/product-families")
      .then((res) => (res.ok ? res.json() : []))
      .then(setFamilies);
  }, []);

  useEffect(() => {
    const timeout = setTimeout(refresh, search ? 300 : 0);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- debounce only cares about `search` changing timing
  }, [page, sortBy, sortDir, status, familyId, search]);

  function handleSortChange(field: string) {
    if (field === sortBy) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortDir("asc");
    }
    setPage(1);
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Search product, SKU, container…"
          className={`${inputClass} w-64`}
        />
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as OrderStatus | "");
            setPage(1);
          }}
          className={inputClass + " w-auto"}
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <select
          value={familyId}
          onChange={(e) => {
            setFamilyId(e.target.value);
            setPage(1);
          }}
          className={inputClass + " w-auto"}
        >
          <option value="">All families</option>
          {families.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>

        <div className="ml-auto flex gap-2">
          <CopyExcelButton />
          {canEdit && (
            <button onClick={() => setAddOpen(true)} className={primaryButtonClass}>
              + New Order
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <p className="py-12 text-center text-sm text-black/40 dark:text-white/40">Loading…</p>
      ) : (
        <>
          <OrderTable
            orders={orders}
            sortBy={sortBy}
            sortDir={sortDir}
            onSortChange={handleSortChange}
            onRowClick={(order) => setSelectedOrderId(order.id)}
          />
          <OrderCardList orders={orders} onRowClick={(order) => setSelectedOrderId(order.id)} />

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 text-sm">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className={`${secondaryButtonClass} disabled:opacity-40`}
              >
                Previous
              </button>
              <span className="text-black/50 dark:text-white/50">
                Page {page} of {totalPages} · {total} orders
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className={`${secondaryButtonClass} disabled:opacity-40`}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}

      {canEdit && (
        <button
          onClick={() => setAddOpen(true)}
          aria-label="New order"
          className="fixed bottom-6 right-6 flex h-14 w-14 items-center justify-center rounded-full bg-black text-2xl text-white shadow-lg md:hidden dark:bg-white dark:text-black"
        >
          +
        </button>
      )}

      <AddOrderModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={() => refresh()}
      />

      <OrderDetailDrawer
        orderId={selectedOrderId}
        onClose={() => setSelectedOrderId(null)}
        currentUser={currentUser}
        onOrderChanged={refresh}
      />
    </div>
  );
}
