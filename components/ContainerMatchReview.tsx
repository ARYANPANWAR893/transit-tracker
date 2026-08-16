"use client";

import { useState } from "react";
import type { ContainerItem } from "@/lib/types";
import { secondaryButtonClass, primaryButtonClass } from "@/lib/formStyles";

const STATUS_LABEL: Record<ContainerItem["matchStatus"], string> = {
  MATCHED: "Matched",
  AMBIGUOUS: "Needs Review",
  UNMATCHED: "Unmatched",
  ERROR: "Error",
};

const STATUS_STYLE: Record<ContainerItem["matchStatus"], string> = {
  MATCHED: "bg-green-100 text-green-800 dark:bg-green-400/15 dark:text-green-300",
  AMBIGUOUS: "bg-amber-100 text-amber-800 dark:bg-amber-400/15 dark:text-amber-300",
  UNMATCHED: "bg-black/10 text-black/60 dark:bg-white/10 dark:text-white/60",
  ERROR: "bg-red-100 text-red-800 dark:bg-red-400/15 dark:text-red-300",
};

function ResolveRow({ item, containerId, onResolved }: { item: ContainerItem; containerId: string; onResolved: () => void }) {
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(body: { orderId: string } | { skip: true }) {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/container-uploads/${containerId}/items/${item.id}/confirm-match`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (!res.ok) {
      const b = await res.json().catch(() => null);
      setError(b?.error || "Failed to resolve this row");
      return;
    }
    onResolved();
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {item.candidateOrders && item.candidateOrders.length > 0 ? (
        <>
          <select
            value={selectedOrderId}
            onChange={(e) => setSelectedOrderId(e.target.value)}
            className="rounded-md border border-black/15 bg-transparent px-2 py-1 text-sm dark:border-white/20"
          >
            <option value="">Pick the correct order…</option>
            {item.candidateOrders.map((c) => (
              <option key={c.id} value={c.id}>
                {c.productName} · qty {c.qty} · req. by {c.createdByName}
              </option>
            ))}
          </select>
          <button
            disabled={!selectedOrderId || busy}
            onClick={() => submit({ orderId: selectedOrderId })}
            className={`${primaryButtonClass} px-3 py-1.5 text-xs`}
          >
            Confirm
          </button>
        </>
      ) : (
        <span className="text-xs text-black/40 dark:text-white/40">No candidate orders found</span>
      )}
      <button disabled={busy} onClick={() => submit({ skip: true })} className={`${secondaryButtonClass} px-3 py-1.5 text-xs`}>
        Skip
      </button>
      {error && <span className="text-xs text-red-600 dark:text-red-400">{error}</span>}
    </div>
  );
}

export default function ContainerMatchReview({
  containerId,
  items,
  onChange,
}: {
  containerId: string;
  items: ContainerItem[];
  onChange: () => void;
}) {
  const [filter, setFilter] = useState<ContainerItem["matchStatus"] | "ALL">("ALL");
  const filtered = filter === "ALL" ? items : items.filter((i) => i.matchStatus === filter);

  const counts = items.reduce(
    (acc, i) => ({ ...acc, [i.matchStatus]: (acc[i.matchStatus] ?? 0) + 1 }),
    {} as Record<string, number>
  );

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2">
        {(["ALL", "MATCHED", "AMBIGUOUS", "UNMATCHED", "ERROR"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium ${
              filter === s
                ? "bg-black text-white dark:bg-white dark:text-black"
                : "bg-black/5 text-black/70 hover:bg-black/10 dark:bg-white/10 dark:text-white/70"
            }`}
          >
            {s === "ALL" ? "All" : STATUS_LABEL[s]} {s === "ALL" ? items.length : (counts[s] ?? 0)}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-black/10 dark:border-white/10">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-black/[0.02] text-xs uppercase text-black/40 dark:bg-white/[0.03] dark:text-white/40">
            <tr>
              <th className="px-3 py-2">Row</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Shipping Mark</th>
              <th className="px-3 py-2">Item No.</th>
              <th className="px-3 py-2">QTY</th>
              <th className="px-3 py-2">Note / Resolve</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((item) => (
              <tr key={item.id} className="border-t border-black/5 align-top dark:border-white/10">
                <td className="px-3 py-2">{item.rowNumber}</td>
                <td className="px-3 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[item.matchStatus]}`}>
                    {STATUS_LABEL[item.matchStatus]}
                  </span>
                </td>
                <td className="px-3 py-2">{item.shippingMark || "—"}</td>
                <td className="px-3 py-2">{item.itemNo || "—"}</td>
                <td className="px-3 py-2">{item.totalQty ?? "—"}</td>
                <td className="px-3 py-2">
                  {item.matchStatus === "AMBIGUOUS" || item.matchStatus === "UNMATCHED" ? (
                    <ResolveRow item={item} containerId={containerId} onResolved={onChange} />
                  ) : (
                    <span className="text-black/50 dark:text-white/50">{item.matchNote || "—"}</span>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-black/40 dark:text-white/40">
                  No rows in this category.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
