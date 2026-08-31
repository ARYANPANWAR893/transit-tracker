"use client";

import type { RequirementListItem } from "@/lib/types";
import StatusPill from "@/components/StatusPill";
import { formatDate } from "@/lib/format";


export default function RequirementCardList({
  requirements, onRowClick,
}: {
  requirements: RequirementListItem[];
  onRowClick: (r: RequirementListItem) => void;
}) {
  if (requirements.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-black/40 dark:text-white/40 md:hidden">
        No requirements found.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 md:hidden">
      {requirements.map((r) => (
        <button
          key={r.id}
          onClick={() => onRowClick(r)}
          className="flex flex-col gap-2 rounded-2xl border border-black/10 bg-white p-4 text-left shadow-sm dark:border-white/10 dark:bg-white/5"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="font-semibold leading-tight">{r.product.name}</h3>
              <p className="text-xs text-black/50 dark:text-white/50">{r.createdBy.name}</p>
            </div>
            <StatusPill status={r.fulfilmentStatus} />
          </div>

          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm text-black/50 dark:text-white/50">
            <span>Required: <span className="tabular-nums">{r.quantities.required.toLocaleString()}</span></span>
            <span>Coming: <span className="tabular-nums">{r.quantities.allocated.toLocaleString()}</span></span>
            <span>Received: <span className="tabular-nums">{r.quantities.received.toLocaleString()}</span></span>
            <span>Needed: {formatDate(r.neededByDate)}</span>
          </div>

          {r.containers.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {r.containers.map((c) => (
                <span key={c.id} className="rounded bg-black/5 px-1.5 py-0.5 text-xs dark:bg-white/10">
                  {c.code}
                </span>
              ))}
            </div>
          )}
        </button>
      ))}
    </div>
  );
}
