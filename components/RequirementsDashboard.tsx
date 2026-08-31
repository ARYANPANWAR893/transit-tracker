"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { FulfilmentStatus, ProductFamily, PublicUser, RequirementListItem, RequirementListResponse } from "@/lib/types";
import RequirementTable from "@/components/RequirementTable";
import RequirementCardList from "@/components/RequirementCardList";
import RequirementDetailDrawer from "@/components/RequirementDetailDrawer";
import CopyExcelButton from "@/components/CopyExcelButton";
import { canCreateRequirement } from "@/lib/permissions";
import { inputClass, primaryButtonClass, secondaryButtonClass } from "@/lib/formStyles";

/** Each role opens on the work that is actually theirs. */
function filtersFor(role: PublicUser["role"]): { label: string; value: FulfilmentStatus | "" }[] {
  if (role === "PROCUREMENT_OWNER") {
    return [
      { label: "Needs procurement", value: "REQUESTED" },
      { label: "Procured", value: "PROCUREMENT_CONFIRMED" },
      { label: "Allocated", value: "ALLOCATED" },
      { label: "All", value: "" },
    ];
  }
  return [
    { label: "All", value: "" },
    { label: "Requested", value: "REQUESTED" },
    { label: "Procured", value: "PROCUREMENT_CONFIRMED" },
    { label: "Allocated", value: "ALLOCATED" },
    { label: "Shipped", value: "FULLY_SHIPPED" },
    { label: "Received", value: "RECEIVED" },
    { label: "Rejected", value: "REJECTED" },
  ];
}

export default function RequirementsDashboard({ currentUser }: { currentUser: PublicUser }) {
  const quickFilters = filtersFor(currentUser.role);
  const [items, setItems] = useState<RequirementListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const [fulfilment, setFulfilment] = useState<FulfilmentStatus | "">(quickFilters[0].value);
  const [familyId, setFamilyId] = useState("");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [families, setFamilies] = useState<ProductFamily[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const canAdd = canCreateRequirement(currentUser);

  const refresh = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize), sortBy, sortDir });
    if (fulfilment) params.set("fulfilment", fulfilment);
    if (familyId) params.set("familyId", familyId);
    if (search) params.set("search", search);

    const res = await fetch(`/api/requirements?${params}`);
    if (res.ok) {
      const data: RequirementListResponse = await res.json();
      setItems(data.items);
      setTotal(data.total);
    }
    setLoading(false);
  }, [page, sortBy, sortDir, fulfilment, familyId, search]);

  useEffect(() => {
    fetch("/api/product-families").then((r) => (r.ok ? r.json() : [])).then(setFamilies);
  }, []);

  useEffect(() => {
    const t = setTimeout(refresh, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [refresh, search]);

  function handleSort(field: string) {
    if (field === sortBy) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortBy(field); setSortDir("asc"); }
    setPage(1);
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {quickFilters.map((f) => (
          <button
            key={f.label}
            onClick={() => { setFulfilment(f.value); setPage(1); }}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
              fulfilment === f.value
                ? "bg-black text-white dark:bg-white dark:text-black"
                : "bg-black/5 text-black/70 hover:bg-black/10 dark:bg-white/10 dark:text-white/70 dark:hover:bg-white/15"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search product, code or requester…"
          className={`${inputClass} sm:w-64`}
        />
        <select
          value={familyId}
          onChange={(e) => { setFamilyId(e.target.value); setPage(1); }}
          className={`${inputClass} sm:w-auto`}
        >
          <option value="">All families</option>
          {families.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
        <div className="flex gap-2 sm:ml-auto">
          <CopyExcelButton />
          {canAdd && (
            <Link href="/requirements/new" className={primaryButtonClass}>+ New Requirement</Link>
          )}
        </div>
      </div>

      {loading ? (
        <p className="py-12 text-center text-sm text-black/40 dark:text-white/40">Loading…</p>
      ) : (
        <>
          <RequirementTable
            requirements={items} sortBy={sortBy} sortDir={sortDir}
            onSortChange={handleSort} onRowClick={(r) => setSelectedId(r.id)}
          />
          <RequirementCardList requirements={items} onRowClick={(r) => setSelectedId(r.id)} />

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 text-sm">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}
                className={`${secondaryButtonClass} disabled:opacity-40`}>Previous</button>
              <span className="text-black/50 dark:text-white/50">
                Page {page} of {totalPages} · {total} requirement{total === 1 ? "" : "s"}
              </span>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                className={`${secondaryButtonClass} disabled:opacity-40`}>Next</button>
            </div>
          )}
        </>
      )}

      {canAdd && (
        <Link
          href="/requirements/new" aria-label="New requirement"
          className="fixed bottom-6 right-6 flex h-14 w-14 items-center justify-center rounded-full bg-black text-2xl text-white shadow-lg md:hidden dark:bg-white dark:text-black"
        >
          +
        </Link>
      )}

      <RequirementDetailDrawer
        requirementId={selectedId}
        onClose={() => setSelectedId(null)}
        currentUser={currentUser}
        onChanged={refresh}
      />
    </div>
  );
}
