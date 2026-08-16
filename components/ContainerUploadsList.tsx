"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { ContainerUpload } from "@/lib/types";

const STATUS_STYLE: Record<ContainerUpload["status"], string> = {
  PROCESSING: "bg-amber-100 text-amber-800 dark:bg-amber-400/15 dark:text-amber-300",
  COMPLETED: "bg-green-100 text-green-800 dark:bg-green-400/15 dark:text-green-300",
  FAILED: "bg-red-100 text-red-800 dark:bg-red-400/15 dark:text-red-300",
};

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function ContainerUploadsList() {
  const [uploads, setUploads] = useState<ContainerUpload[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/container-uploads")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        setUploads(data);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return <p className="py-12 text-center text-sm text-black/40 dark:text-white/40">Loading…</p>;
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-black/10 dark:border-white/10">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="bg-black/[0.02] text-xs uppercase text-black/40 dark:bg-white/[0.03] dark:text-white/40">
          <tr>
            <th className="px-3 py-2">Container</th>
            <th className="px-3 py-2">File</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Matched</th>
            <th className="px-3 py-2">Needs Review</th>
            <th className="px-3 py-2">Unmatched</th>
            <th className="px-3 py-2">Uploaded By</th>
            <th className="px-3 py-2">Date</th>
          </tr>
        </thead>
        <tbody>
          {uploads.map((u) => (
            <tr key={u.id} className="border-t border-black/5 dark:border-white/10">
              <td className="px-3 py-2">
                <Link href={`/container-uploads/${u.id}`} className="font-medium underline">
                  {u.containerName}
                </Link>
              </td>
              <td className="px-3 py-2 text-black/60 dark:text-white/60">{u.fileName}</td>
              <td className="px-3 py-2">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[u.status]}`}>
                  {u.status}
                </span>
              </td>
              <td className="px-3 py-2">{u.matchedCount}</td>
              <td className="px-3 py-2">{u.ambiguousCount}</td>
              <td className="px-3 py-2">{u.unmatchedCount}</td>
              <td className="px-3 py-2">{u.uploadedBy.name}</td>
              <td className="px-3 py-2 text-black/60 dark:text-white/60">{formatDateTime(u.createdAt)}</td>
            </tr>
          ))}
          {uploads.length === 0 && (
            <tr>
              <td colSpan={8} className="py-6 text-center text-black/40 dark:text-white/40">
                No container uploads yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
