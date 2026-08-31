import type { QuantityBreakdown } from "@/lib/types";

/**
 * The quantity overview that answers "how much is where?". Received, in transit
 * and allocated are nested stages of the same required total, so they are shown
 * as one bar rather than three unrelated numbers.
 */
export default function QuantityBreakdownBar({ q, compact }: { q: QuantityBreakdown; compact?: boolean }) {
  const pct = (n: number) => (q.required > 0 ? Math.min(100, (n / q.required) * 100) : 0);

  const rows: { label: string; value: number; className: string }[] = [
    { label: "Required", value: q.required, className: "" },
    { label: "Procured", value: q.procured, className: "text-sky-700 dark:text-sky-300" },
    { label: "Allocated", value: q.allocated, className: "text-indigo-700 dark:text-indigo-300" },
    { label: "In transit", value: q.inTransit, className: "text-violet-700 dark:text-violet-300" },
    { label: "Received", value: q.received, className: "text-emerald-700 dark:text-emerald-300" },
    { label: "Outstanding", value: q.outstanding, className: q.outstanding > 0 ? "text-amber-700 dark:text-amber-400" : "text-black/40 dark:text-white/40" },
  ];

  return (
    <div className="flex flex-col gap-2">
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
        <div className="absolute inset-y-0 left-0 bg-indigo-400/70" style={{ width: `${pct(q.allocated)}%` }} />
        <div className="absolute inset-y-0 left-0 bg-violet-500/80" style={{ width: `${pct(q.inTransit)}%` }} />
        <div className="absolute inset-y-0 left-0 bg-emerald-500" style={{ width: `${pct(q.received)}%` }} />
      </div>
      <dl className={`grid gap-x-4 gap-y-1 ${compact ? "grid-cols-3" : "grid-cols-2 sm:grid-cols-3"}`}>
        {rows.map((r) => (
          <div key={r.label} className="flex items-baseline justify-between gap-2">
            <dt className="text-xs uppercase tracking-wide text-black/40 dark:text-white/40">{r.label}</dt>
            <dd className={`text-sm font-medium tabular-nums ${r.className}`}>{r.value.toLocaleString()}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
