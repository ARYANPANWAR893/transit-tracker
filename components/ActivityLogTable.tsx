"use client";

import { useCallback, useEffect, useState } from "react";
import type { ActivityLog } from "@/lib/types";
import { inputClass, secondaryButtonClass } from "@/lib/formStyles";

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}

function jsonSummary(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export default function ActivityLogTable() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const pageSize = 50;

  const refresh = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (search) params.set("search", search);
    const res = await fetch(`/api/activity-logs?${params.toString()}`);
    if (res.ok) {
      const data = await res.json();
      setLogs(data.items);
      setTotal(data.total);
    }
    setLoading(false);
  }, [page, search]);

  useEffect(() => {
    const timeout = setTimeout(refresh, search ? 300 : 0);
    return () => clearTimeout(timeout);
  }, [refresh, search]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="flex flex-col gap-3">
      <input
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setPage(1);
        }}
        placeholder="Search actor, action, entity, remarks…"
        className={`${inputClass} w-72`}
      />

      {loading ? (
        <p className="py-12 text-center text-sm text-black/40 dark:text-white/40">Loading…</p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-2xl border border-black/10 dark:border-white/10">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-black/[0.02] text-xs uppercase text-black/40 dark:bg-white/[0.03] dark:text-white/40">
                <tr>
                  <th className="px-3 py-2">Timestamp</th>
                  <th className="px-3 py-2">Actor</th>
                  <th className="px-3 py-2">Role</th>
                  <th className="px-3 py-2">Action</th>
                  <th className="px-3 py-2">Entity</th>
                  <th className="px-3 py-2">Before</th>
                  <th className="px-3 py-2">After</th>
                  <th className="px-3 py-2">Remarks</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-t border-black/5 align-top dark:border-white/10">
                    <td className="whitespace-nowrap px-3 py-2 text-black/60 dark:text-white/60">
                      {formatDateTime(log.createdAt)}
                    </td>
                    <td className="px-3 py-2">{log.actor?.name ?? "System"}</td>
                    <td className="px-3 py-2">{log.actorRole ?? "—"}</td>
                    <td className="px-3 py-2 font-medium">{log.action}</td>
                    <td className="px-3 py-2">
                      {log.entityType}
                      {log.entityId && <span className="text-black/40 dark:text-white/40"> #{log.entityId.slice(-6)}</span>}
                    </td>
                    <td className="max-w-[200px] truncate px-3 py-2 text-xs text-black/50 dark:text-white/50" title={jsonSummary(log.previousValue)}>
                      {jsonSummary(log.previousValue)}
                    </td>
                    <td className="max-w-[200px] truncate px-3 py-2 text-xs text-black/50 dark:text-white/50" title={jsonSummary(log.newValue)}>
                      {jsonSummary(log.newValue)}
                    </td>
                    <td className="max-w-[200px] truncate px-3 py-2 text-xs text-black/50 dark:text-white/50" title={log.remarks ?? ""}>
                      {log.remarks ?? ""}
                    </td>
                  </tr>
                ))}
                {logs.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-6 text-center text-black/40 dark:text-white/40">
                      No activity recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

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
                Page {page} of {totalPages} · {total} entries
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
    </div>
  );
}
