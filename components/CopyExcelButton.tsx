"use client";

import { useState } from "react";
import { shipmentsToTsv } from "@/lib/tsv";
import type { Shipment } from "@/lib/types";

export default function CopyExcelButton({ shipments }: { shipments: Shipment[] }) {
  const [copied, setCopied] = useState(false);
  const pendingCount = shipments.filter((s) => s.status !== "ARRIVED").length;

  async function handleCopy() {
    await navigator.clipboard.writeText(shipmentsToTsv(shipments));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button
      onClick={handleCopy}
      className="rounded-lg border border-black/15 px-3.5 py-2 text-sm font-medium hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
    >
      {copied ? "Copied!" : `Copy Excel (${pendingCount})`}
    </button>
  );
}
