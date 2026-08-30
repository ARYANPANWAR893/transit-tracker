"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { OrderListItem, OrderListResponse, OrderStatus, ProductFamily, PublicUser } from "@/lib/types";
import OrderTable from "@/components/OrderTable";
import OrderCardList from "@/components/OrderCardList";
import OrderDetailDrawer from "@/components/OrderDetailDrawer";
import CopyExcelButton from "@/components/CopyExcelButton";
import AdminStatTiles from "@/components/AdminStatTiles";
import { canCreateOrder } from "@/lib/permissions";
import { inputClass, primaryButtonClass, secondaryButtonClass } from "@/lib/formStyles";

function quickFiltersFor(role: PublicUser["role"]): { label: string; status: OrderStatus | "" }[] {
  if (role === "ORDER_ACCEPTER") {
    return [
      { label: "All", status: "" },
      { label: "New Requests", status: "REQUESTED" },
      { label: "Accepted", status: "ACCEPTED" },
      { label: "In Transit", status: "IN_TRANSIT" },
      { label: "Awaiting Confirmation", status: "ARRIVED" },
    ];
  }
  // ORDERER and ADMIN get the fuller set
  return [
    { label: "All", status: "" },
    { label: "Requested", status: "REQUESTED" },
    { label: "Accepted", status: "ACCEPTED" },
    { label: "In Transit", status: "IN_TRANSIT" },
    { label: "Awaiting Confirmation", status: "ARRIVED" },
    { label: "Completed", status: "CONFIRMED_RECEIVED" },
    { label: "Rejected", status: "REJECTED" },
    { label: "Withdrawn", status: "WITHDRAWN" },
  ];
}

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
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const canAdd = canCreateOrder(currentUser);
  const quickFilters = quickFiltersFor(currentUser.role);

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

    const fromUrl = new URLSearchParams(window.location.search).get("status");
    if (fromUrl) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- applying a status filter from the URL once, on mount
      setStatus(fromUrl as OrderStatus);
    }
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
      {currentUser.role === "ADMIN" && <AdminStatTiles />}

      <div className="flex gap-2 overflow-x-auto pb-1">
        {quickFilters.map((f) => (
          <button
            key={f.label}
            onClick={() => {
              setStatus(f.status);
              setPage(1);
            }}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
              status === f.status
                ? "bg-black text-white dark:bg-white dark:text-black"
                : "bg-black/5 text-black/70 hover:bg-black/10 dark:bg-white/10 dark:text-white/70 dark:hover:bg-white/15"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Search product, SKU/ASIN, requester…"
          className={`${inputClass} w-64`}
        />
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
          {canAdd && (
            <Link href="/orders/new" className={primaryButtonClass}>
              + New Order
            </Link>
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

      {canAdd && (
        <Link
          href="/orders/new"
          aria-label="New order"
          className="fixed bottom-6 right-6 flex h-14 w-14 items-center justify-center rounded-full bg-black text-2xl text-white shadow-lg md:hidden dark:bg-white dark:text-black"
        >
          +
        </Link>
      )}

      <OrderDetailDrawer
        orderId={selectedOrderId}
        onClose={() => setSelectedOrderId(null)}
        currentUser={currentUser}
        onOrderChanged={refresh}
      />
    </div>
  );
}
