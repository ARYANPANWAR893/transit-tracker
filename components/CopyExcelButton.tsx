"use client";

import { useState } from "react";
import { ordersToTsv } from "@/lib/tsv";
import type { OrderListResponse } from "@/lib/types";

/** Always exports every non-arrived order, independent of the dashboard's current filters. */
export default function CopyExcelButton() {
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleCopy() {
    setLoading(true);
    const res = await fetch("/api/orders?pageSize=1000&sortBy=neededByDate&sortDir=asc");
    setLoading(false);
    if (!res.ok) return;

    const data: OrderListResponse = await res.json();
    await navigator.clipboard.writeText(ordersToTsv(data.items));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button
      onClick={handleCopy}
      disabled={loading}
      className="rounded-lg border border-black/15 px-3.5 py-2 text-sm font-medium hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
    >
      {copied ? "Copied!" : loading ? "Copying…" : "Copy Excel"}
    </button>
  );
}
