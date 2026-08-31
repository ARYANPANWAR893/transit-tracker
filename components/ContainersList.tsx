"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { Container, PublicUser } from "@/lib/types";
import { ContainerStatusPill } from "@/components/StatusPill";
import { canManageContainers } from "@/lib/permissions";
import { daysUntil } from "@/lib/shipping";
import { inputClass, labelClass, primaryButtonClass } from "@/lib/formStyles";
import { formatDate } from "@/lib/format";


export default function ContainersList({ currentUser }: { currentUser: PublicUser }) {
  const [containers, setContainers] = useState<Container[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [code, setCode] = useState("");
  const [loadingDate, setLoadingDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const canManage = canManageContainers(currentUser);

  const refresh = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/containers${search ? `?search=${encodeURIComponent(search)}` : ""}`);
    if (res.ok) setContainers(await res.json());
    setLoading(false);
  }, [search]);

  useEffect(() => {
    const t = setTimeout(refresh, search ? 250 : 0);
    return () => clearTimeout(t);
  }, [refresh, search]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    const res = await fetch("/api/containers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, loadingDate: loadingDate || null }),
    });
    setBusy(false);
    if (!res.ok) return setError((await res.json().catch(() => null))?.error || "Couldn't create the container");
    setCode(""); setLoadingDate(""); setShowForm(false);
    refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <input
          value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search container code…" className={`${inputClass} sm:w-64`}
        />
        {canManage && (
          <button onClick={() => setShowForm((v) => !v)} className={primaryButtonClass}>
            {showForm ? "Cancel" : "+ Container"}
          </button>
        )}
      </div>

      {showForm && canManage && (
        <form onSubmit={create} className="rounded-2xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-white/5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={labelClass} htmlFor="cc">Container code</label>
              <input
                id="cc" required autoFocus value={code} onChange={(e) => setCode(e.target.value)}
                placeholder="e.g. YS16" className={inputClass}
              />
              <p className="mt-1 text-xs text-black/50 dark:text-white/50">
                Spacing and case are ignored — &ldquo;YS 16&rdquo; and &ldquo;ys16&rdquo; are the same container.
              </p>
            </div>
            <div>
              <label className={labelClass} htmlFor="cl">Loading date (optional)</label>
              <input id="cl" type="date" value={loadingDate} onChange={(e) => setLoadingDate(e.target.value)} className={inputClass} />
              <p className="mt-1 text-xs text-black/50 dark:text-white/50">
                The arrival date is calculated from this — you never enter it.
              </p>
            </div>
          </div>
          {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
          <button type="submit" disabled={busy || !code.trim()} className={`mt-3 ${primaryButtonClass}`}>
            {busy ? "Creating…" : "Create Container"}
          </button>
        </form>
      )}

      {loading ? (
        <p className="py-12 text-center text-sm text-black/40 dark:text-white/40">Loading…</p>
      ) : containers.length === 0 ? (
        <p className="rounded-xl border border-dashed border-black/15 p-6 text-center text-sm text-black/50 dark:border-white/20 dark:text-white/50">
          No containers yet.
        </p>
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-2xl border border-black/10 md:block dark:border-white/10">
            <table className="w-full text-left text-sm">
              <thead className="bg-black/[0.02] text-xs uppercase text-black/40 dark:bg-white/[0.03] dark:text-white/40">
                <tr>
                  <th className="px-3 py-2">Container</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Loading</th>
                  <th className="px-3 py-2">ETA</th>
                  <th className="px-3 py-2 text-right">Products</th>
                  <th className="px-3 py-2 text-right">Units</th>
                  <th className="px-3 py-2 text-right">Exceptions</th>
                </tr>
              </thead>
              <tbody>
                {containers.map((c) => {
                  const days = daysUntil(c.expectedArrivalDate);
                  return (
                    <tr key={c.id} className="border-t border-black/5 dark:border-white/10">
                      <td className="px-3 py-2.5">
                        <Link href={`/containers/${c.id}`} className="font-medium hover:underline">{c.code}</Link>
                      </td>
                      <td className="px-3 py-2.5"><ContainerStatusPill status={c.status} /></td>
                      <td className="px-3 py-2.5">{formatDate(c.loadingDate)}</td>
                      <td className="px-3 py-2.5">
                        {formatDate(c.expectedArrivalDate)}
                        {days !== null && (
                          <span className="ml-1 text-xs text-black/40 dark:text-white/40">
                            {days >= 0 ? `· ${days}d` : `· ${Math.abs(days)}d ago`}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{c.allocationCount}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{c.totalAllocatedQty.toLocaleString()}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        {c.exceptionCount > 0
                          ? <span className="text-amber-700 dark:text-amber-400">{c.exceptionCount}</span>
                          : <span className="text-black/30 dark:text-white/30">0</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-1 gap-3 md:hidden">
            {containers.map((c) => (
              <Link
                key={c.id} href={`/containers/${c.id}`}
                className="flex flex-col gap-2 rounded-2xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-white/5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">{c.code}</span>
                  <ContainerStatusPill status={c.status} />
                </div>
                <div className="grid grid-cols-2 gap-1 text-sm text-black/50 dark:text-white/50">
                  <span>Loading: {formatDate(c.loadingDate)}</span>
                  <span>ETA: {formatDate(c.expectedArrivalDate)}</span>
                  <span>{c.allocationCount} product(s)</span>
                  <span className="tabular-nums">{c.totalAllocatedQty.toLocaleString()} units</span>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
