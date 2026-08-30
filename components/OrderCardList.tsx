"use client";

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

export default function OrderCardList({
  orders,
  onRowClick,
}: {
  orders: OrderListItem[];
  onRowClick: (order: OrderListItem) => void;
}) {
  if (orders.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-black/40 dark:text-white/40 md:hidden">
        No orders found.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 md:hidden">
      {orders.map((order) => (
        <button
          key={order.id}
          onClick={() => onRowClick(order)}
          className="flex flex-col gap-2 rounded-2xl border border-black/10 bg-white p-4 text-left shadow-sm dark:border-white/10 dark:bg-white/5"
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-semibold leading-tight">{order.product.name}</h3>
              <p className="text-xs text-black/50 dark:text-white/50">
                {order.createdBy.name}
                {order.acceptedPriceInr !== null && ` · ${money(order.acceptedPriceInr, "INR")}`}
              </p>
            </div>
            <StatusPill status={order.status} />
          </div>

          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
            <span className="text-black/50 dark:text-white/50">
              QTY: {order.acceptedQty !== null ? `${order.acceptedQty}/${order.qty}` : order.qty}
            </span>
            <span className="text-black/50 dark:text-white/50">Needed: {formatDate(order.neededByDate)}</span>
            {order.containerName && (
              <span className="text-black/50 dark:text-white/50">Container: {order.containerName}</span>
            )}
            {order.acceptedExpectedArrivalDate && (
              <span className="text-black/50 dark:text-white/50">
                Expected: {formatDate(order.acceptedExpectedArrivalDate)}
              </span>
            )}
          </div>

          {(order.remarkCount > 0 || order.photoCount > 0) && (
            <div className="flex gap-2 text-xs text-black/40 dark:text-white/40">
              {order.remarkCount > 0 && <span>💬 {order.remarkCount}</span>}
              {order.photoCount > 0 && <span>📷 {order.photoCount}</span>}
            </div>
          )}
        </button>
      ))}
    </div>
  );
}
