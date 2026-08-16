"use client";

import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
  type SortingState,
} from "@tanstack/react-table";
import type { OrderListItem } from "@/lib/types";
import StatusPill from "@/components/StatusPill";

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function money(amount: number | null, currency: string): string {
  if (amount === null) return "—";
  const symbol = currency === "INR" ? "₹" : currency === "CNY" ? "¥" : `${currency} `;
  return `${symbol}${amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

const columnHelper = createColumnHelper<OrderListItem>();

const columns = [
  columnHelper.accessor((row) => row.status, {
    id: "status",
    header: "Status",
    cell: (info) => <StatusPill status={info.getValue()} />,
  }),
  columnHelper.accessor((row) => row.product.name, {
    id: "productName",
    header: "Product",
    cell: (info) => {
      const row = info.row.original;
      const ids = [row.product.maSku && `MASKU ${row.product.maSku}`, row.product.kmwId && `KMW ${row.product.kmwId}`]
        .filter(Boolean)
        .join(" · ");
      return (
        <div>
          <div className="font-medium">{row.product.name}</div>
          {ids && <div className="text-xs text-black/40 dark:text-white/40">{ids}</div>}
        </div>
      );
    },
  }),
  columnHelper.display({
    id: "requester",
    header: "Requested By",
    cell: (info) => info.row.original.createdBy.name,
  }),
  columnHelper.accessor((row) => row.qty, {
    id: "qty",
    header: "QTY",
    cell: (info) => {
      const row = info.row.original;
      return row.acceptedQty !== null ? `${row.acceptedQty}/${row.qty}` : row.qty;
    },
  }),
  columnHelper.accessor((row) => row.requestedPriceInr, {
    id: "requestedPriceInr",
    header: "Price",
    cell: (info) => {
      const row = info.row.original;
      return (
        <div>
          <div>{money(row.requestedPriceInr, "INR")}</div>
          {row.requestedPriceCny !== null && (
            <div className="text-xs text-black/40 dark:text-white/40">≈ {money(row.requestedPriceCny, "CNY")}</div>
          )}
        </div>
      );
    },
  }),
  columnHelper.accessor((row) => row.neededByDate, {
    id: "neededByDate",
    header: "Needed By",
    cell: (info) => formatDate(info.getValue()),
  }),
  columnHelper.display({
    id: "container",
    header: "Container",
    cell: (info) => info.row.original.containerName ?? "—",
  }),
  columnHelper.display({
    id: "expectedArrival",
    header: "Expected Arrival",
    cell: (info) => formatDate(info.row.original.acceptedExpectedArrivalDate),
  }),
  columnHelper.display({
    id: "meta",
    header: "",
    cell: (info) => {
      const row = info.row.original;
      return (
        <span className="flex gap-2 whitespace-nowrap text-xs text-black/40 dark:text-white/40">
          {row.remarkCount > 0 && <span title="Remarks">💬 {row.remarkCount}</span>}
          {row.photoCount > 0 && <span title="Photos">📷 {row.photoCount}</span>}
        </span>
      );
    },
  }),
];

const SORTABLE_COLUMN_IDS = new Set([
  "status",
  "productName",
  "qty",
  "requestedPriceInr",
  "neededByDate",
]);

export default function OrderTable({
  orders,
  sortBy,
  sortDir,
  onSortChange,
  onRowClick,
}: {
  orders: OrderListItem[];
  sortBy: string;
  sortDir: "asc" | "desc";
  onSortChange: (field: string) => void;
  onRowClick: (order: OrderListItem) => void;
}) {
  const sorting: SortingState = [{ id: sortBy, desc: sortDir === "desc" }];

  const table = useReactTable({
    data: orders,
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
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                const sortable = SORTABLE_COLUMN_IDS.has(header.column.id);
                return (
                  <th key={header.id} className="whitespace-nowrap px-3 py-2">
                    {sortable ? (
                      <button
                        onClick={() => onSortChange(header.column.id)}
                        className="flex items-center gap-1 hover:text-black dark:hover:text-white"
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {sortBy === header.column.id && (sortDir === "asc" ? "↑" : "↓")}
                      </button>
                    ) : (
                      flexRender(header.column.columnDef.header, header.getContext())
                    )}
                  </th>
                );
              })}
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
          {orders.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="py-8 text-center text-black/40 dark:text-white/40">
                No orders found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
