"use client";

import Link from "next/link";
import {
  createColumnHelper, flexRender, getCoreRowModel, useReactTable, type SortingState,
} from "@tanstack/react-table";
import type { RequirementListItem } from "@/lib/types";
import StatusPill from "@/components/StatusPill";
import { identifierSummary } from "@/components/ProductPicker";
import { formatDate } from "@/lib/format";


const col = createColumnHelper<RequirementListItem>();

const columns = [
  col.accessor((r) => r.fulfilmentStatus, {
    id: "status",
    header: "Status",
    cell: (i) => <StatusPill status={i.getValue()} />,
  }),
  col.accessor((r) => r.product.name, {
    id: "productName",
    header: "Product",
    cell: (i) => {
      const r = i.row.original;
      return (
        <div className="min-w-0">
          <Link
            href={`/products/${r.productId}`}
            onClick={(e) => e.stopPropagation()}
            className="font-medium hover:underline"
          >
            {r.product.name}
          </Link>
          <div className="truncate text-xs text-black/40 dark:text-white/40">
            {identifierSummary(r.product)}
          </div>
        </div>
      );
    },
  }),
  col.display({ id: "requester", header: "Raised By", cell: (i) => i.row.original.createdBy.name }),
  col.accessor((r) => r.quantities.required, {
    id: "requiredQty",
    header: "Required",
    cell: (i) => <span className="tabular-nums">{i.getValue().toLocaleString()}</span>,
  }),
  col.display({
    id: "coming",
    header: "Coming",
    cell: (i) => {
      const q = i.row.original.quantities;
      return <span className="tabular-nums">{(q.allocated).toLocaleString()}</span>;
    },
  }),
  col.display({
    id: "received",
    header: "Received",
    cell: (i) => <span className="tabular-nums">{i.row.original.quantities.received.toLocaleString()}</span>,
  }),
  col.display({
    id: "outstanding",
    header: "Outstanding",
    cell: (i) => {
      const n = i.row.original.quantities.outstanding;
      return (
        <span className={`tabular-nums ${n > 0 ? "text-amber-700 dark:text-amber-400" : "text-black/40 dark:text-white/40"}`}>
          {n.toLocaleString()}
        </span>
      );
    },
  }),
  col.accessor((r) => r.neededByDate, {
    id: "neededByDate",
    header: "Needed By",
    cell: (i) => formatDate(i.getValue()),
  }),
  col.display({
    id: "containers",
    header: "Containers",
    cell: (i) => {
      const cs = i.row.original.containers;
      if (cs.length === 0) return <span className="text-black/40 dark:text-white/40">—</span>;
      return (
        <span className="flex flex-wrap gap-1">
          {cs.map((c) => (
            <Link
              key={c.id}
              href={`/containers/${c.id}`}
              onClick={(e) => e.stopPropagation()}
              className="rounded bg-black/5 px-1.5 py-0.5 text-xs font-medium hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/20"
            >
              {c.code}
            </Link>
          ))}
        </span>
      );
    },
  }),
];

const SORTABLE = new Set(["status", "productName", "requiredQty", "neededByDate"]);

export default function RequirementTable({
  requirements, sortBy, sortDir, onSortChange, onRowClick,
}: {
  requirements: RequirementListItem[];
  sortBy: string;
  sortDir: "asc" | "desc";
  onSortChange: (field: string) => void;
  onRowClick: (r: RequirementListItem) => void;
}) {
  const sorting: SortingState = [{ id: sortBy, desc: sortDir === "desc" }];
  const table = useReactTable({
    data: requirements,
    columns,
    state: { sorting },
    manualSorting: true,
    onSortingChange: (updater) => {
      const next = typeof updater === "function" ? updater(sorting) : updater;
      if (next[0]) onSortChange(next[0].id);
    },
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="hidden overflow-x-auto rounded-2xl border border-black/10 md:block dark:border-white/10">
      <table className="w-full text-left text-sm">
        <thead className="bg-black/[0.02] text-xs uppercase text-black/40 dark:bg-white/[0.03] dark:text-white/40">
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((h) => (
                <th key={h.id} className="whitespace-nowrap px-3 py-2">
                  {SORTABLE.has(h.column.id) ? (
                    <button
                      onClick={() => onSortChange(h.column.id)}
                      className="flex items-center gap-1 hover:text-black dark:hover:text-white"
                    >
                      {flexRender(h.column.columnDef.header, h.getContext())}
                      {sortBy === h.column.id && (sortDir === "asc" ? "↑" : "↓")}
                    </button>
                  ) : (
                    flexRender(h.column.columnDef.header, h.getContext())
                  )}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr
              key={row.id}
              onClick={() => onRowClick(row.original)}
              className="cursor-pointer border-t border-black/5 hover:bg-black/[0.02] dark:border-white/10 dark:hover:bg-white/[0.03]"
            >
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="px-3 py-2.5">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
          {requirements.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="py-8 text-center text-black/40 dark:text-white/40">
                No requirements found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
