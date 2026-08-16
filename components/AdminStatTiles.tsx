"use client";

import { useEffect, useState } from "react";
import type { OrderStatus } from "@/lib/types";

const TILES: { label: string; status: OrderStatus | "" }[] = [
  { label: "Total Orders", status: "" },
  { label: "Requested", status: "REQUESTED" },
  { label: "Accepted", status: "ACCEPTED" },
  { label: "In Transit", status: "IN_TRANSIT" },
  { label: "Awaiting Confirmation", status: "ARRIVED" },
  { label: "Completed", status: "CONFIRMED_RECEIVED" },
];

export default function AdminStatTiles() {
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    Promise.all(
      TILES.map((t) =>
        fetch(`/api/orders?pageSize=1${t.status ? `&status=${t.status}` : ""}`)
          .then((res) => (res.ok ? res.json() : { total: 0 }))
          .then((data) => [t.status, data.total] as const)
      )
    ).then((results) => {
      setCounts(Object.fromEntries(results));
    });
  }, []);

  return (
    <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-6">
      {TILES.map((t) => (
        <div
          key={t.label}
          className="rounded-xl border border-black/10 bg-white p-3 dark:border-white/10 dark:bg-white/5"
        >
          <div className="text-xs uppercase tracking-wide text-black/40 dark:text-white/40">{t.label}</div>
          <div className="text-xl font-semibold">{counts[t.status] ?? "…"}</div>
        </div>
      ))}
    </div>
  );
}
