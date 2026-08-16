"use client";

import { useCallback, useEffect, useState } from "react";
import type { OrderDetail, PublicUser } from "@/lib/types";
import StatusPill from "@/components/StatusPill";
import RemarksPanel from "@/components/RemarksPanel";
import PhotoGallery from "@/components/PhotoGallery";
import AcceptModal from "@/components/AcceptModal";
import RejectOrderModal from "@/components/RejectOrderModal";
import { canActOnFulfillment, canConfirmReceipt, canWithdrawOrder } from "@/lib/permissions";
import { primaryButtonClass, dangerTextButtonClass } from "@/lib/formStyles";

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDateTime(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function money(amount: number | null, currency: string): string {
  if (amount === null) return "—";
  const symbol = currency === "INR" ? "₹" : currency === "CNY" ? "¥" : `${currency} `;
  return `${symbol}${amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-black/40 dark:text-white/40">{label}</dt>
      <dd className="text-sm">{value}</dd>
    </div>
  );
}

function identifierRows(product: OrderDetail["product"]) {
  return [
    ["Amazon SKU", product.amazonSku],
    ["Amazon ASIN", product.amazonAsin],
    ["Flipkart SKU", product.flipkartSku],
    ["Flipkart ASIN", product.flipkartAsin],
    ["MASKU", product.maSku],
    ["KMW ID", product.kmwId],
  ].filter(([, v]) => v) as [string, string][];
}

export default function OrderDetailDrawer({
  orderId,
  onClose,
  currentUser,
  onOrderChanged,
}: {
  orderId: string | null;
  onClose: () => void;
  currentUser: PublicUser;
  onOrderChanged: () => void;
}) {
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [acceptOpen, setAcceptOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!orderId) return;
    setLoading(true);
    const res = await fetch(`/api/orders/${orderId}`);
    if (res.ok) setOrder(await res.json());
    setLoading(false);
  }, [orderId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load order detail when selection changes
    if (orderId) refresh();
    else setOrder(null);
  }, [orderId, refresh]);

  function handleMutated(updated: OrderDetail) {
    setOrder(updated);
    onOrderChanged();
  }

  async function handleAction(path: string, action: string) {
    if (!order) return;
    setBusy(true);
    setActionError(null);
    const res = await fetch(`/api/orders/${order.id}/${path}`, { method: "PATCH" });
    setBusy(false);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setActionError(body?.error || `Failed to ${action}`);
      return;
    }
    handleMutated(await res.json());
  }

  if (!orderId) return null;

  const isOwner = order?.createdById === currentUser.id;
  const canFulfill = canActOnFulfillment(currentUser);
  const canWithdraw = order ? canWithdrawOrder(currentUser, order) : false;
  const canConfirm = order ? canConfirmReceipt(currentUser, order) : false;

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/40">
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />
      <div className="relative flex h-full w-full max-w-xl flex-col overflow-y-auto bg-white p-5 shadow-xl dark:bg-[#111316]">
        <div className="mb-4 flex items-start justify-between">
          <div>
            {order && <h2 className="text-lg font-semibold">{order.product.name}</h2>}
            {order && (
              <p className="text-sm text-black/50 dark:text-white/50">
                {identifierRows(order.product)
                  .map(([label, v]) => `${label} ${v}`)
                  .join(" · ") || "No identifiers on file"}
                {order.product.family && ` · ${order.product.family.name}`}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1.5 text-black/50 hover:bg-black/5 dark:text-white/50 dark:hover:bg-white/10"
          >
            ✕
          </button>
        </div>

        {loading && !order ? (
          <p className="text-sm text-black/40 dark:text-white/40">Loading…</p>
        ) : order ? (
          <div className="flex flex-col gap-5">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill status={order.status} />
              {isOwner && <span className="text-xs text-black/40 dark:text-white/40">Your order</span>}
            </div>

            <dl className="grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-3">
              <Field label="QTY requested" value={String(order.qty)} />
              <Field label="Requested price" value={money(order.requestedPriceInr, "INR")} />
              <Field label="≈ CNY" value={money(order.requestedPriceCny, "CNY")} />
              <Field label="Requested" value={formatDate(order.requestedDate)} />
              <Field label="Needed by" value={formatDate(order.neededByDate)} />
              <Field label="Requested by" value={order.createdBy.name} />
            </dl>

            {order.status !== "REQUESTED" && order.acceptedQty !== null && (
              <div>
                <h3 className="mb-2 text-sm font-semibold">Acceptance</h3>
                <dl className="grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-3">
                  <Field label="QTY accepted" value={String(order.acceptedQty)} />
                  <Field label="Accepted price" value={money(order.acceptedPriceCny, "CNY")} />
                  <Field label="≈ INR" value={money(order.acceptedPriceInr, "INR")} />
                  <Field label="Expected arrival" value={formatDate(order.acceptedExpectedArrivalDate)} />
                  <Field label="Accepted on" value={formatDate(order.acceptanceDate)} />
                  <Field label="Accepted by" value={order.acceptedBy?.name ?? "—"} />
                </dl>
              </div>
            )}

            {order.status === "REJECTED" && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm dark:border-red-500/20 dark:bg-red-500/10">
                <p className="font-medium text-red-800 dark:text-red-300">
                  Rejected by {order.rejectedBy?.name} on {formatDate(order.rejectedAt)}
                </p>
                <p className="mt-1 text-red-700 dark:text-red-400">{order.rejectionReason}</p>
              </div>
            )}

            {order.status === "WITHDRAWN" && (
              <p className="text-sm text-black/50 dark:text-white/50">
                Withdrawn by {order.withdrawnBy?.name} on {formatDate(order.withdrawnAt)}
              </p>
            )}

            {order.arrivedAt && (
              <Field label="Marked arrived" value={`${formatDate(order.arrivedAt)} by ${order.arrivedBy?.name ?? "—"}`} />
            )}
            {order.confirmedReceivedAt && (
              <Field
                label="Confirmed received"
                value={`${formatDateTime(order.confirmedReceivedAt)} by ${order.confirmedBy?.name ?? "—"}`}
              />
            )}

            {order.containerItems.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-semibold">Container Match</h3>
                <ul className="flex flex-col gap-1.5 text-sm">
                  {order.containerItems.map((ci) => (
                    <li
                      key={ci.id}
                      className="rounded-lg border border-black/10 px-2.5 py-1.5 dark:border-white/10"
                    >
                      Row {ci.rowNumber} · {ci.shippingMark || ci.itemNo || "—"} · QTY {ci.totalQty ?? "—"}
                      {ci.matchNote && (
                        <span className="block text-xs text-amber-700 dark:text-amber-400">{ci.matchNote}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {order.conversions.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-semibold">Currency Conversions</h3>
                <ul className="flex flex-col gap-1.5 text-sm">
                  {order.conversions.map((c) => (
                    <li
                      key={c.id}
                      className="flex justify-between rounded-lg border border-black/10 px-2.5 py-1.5 dark:border-white/10"
                    >
                      <span>
                        {c.kind === "REQUEST" ? "Request" : "Acceptance"}: {money(c.originalAmount, c.originalCurrency)}
                        {" → "}
                        {money(c.convertedAmount, c.convertedCurrency)}
                      </span>
                      <span className="text-black/50 dark:text-white/50">
                        rate {c.rate} · {formatDate(c.rateTimestamp)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {actionError && <p className="text-sm text-red-600 dark:text-red-400">{actionError}</p>}

            <div className="flex flex-wrap gap-2">
              {canFulfill && order.status === "REQUESTED" && (
                <>
                  <button onClick={() => setAcceptOpen(true)} className={primaryButtonClass}>
                    Accept
                  </button>
                  <button onClick={() => setRejectOpen(true)} className="rounded-lg bg-red-600 px-4 py-2.5 text-base font-medium text-white hover:bg-red-700">
                    Reject
                  </button>
                </>
              )}
              {canFulfill && order.status === "IN_TRANSIT" && (
                <button disabled={busy} onClick={() => handleAction("mark-arrived", "mark arrived")} className={primaryButtonClass}>
                  Mark Arrived
                </button>
              )}
              {canConfirm && (
                <button disabled={busy} onClick={() => handleAction("confirm-received", "confirm receipt")} className={primaryButtonClass}>
                  Confirm Arrival Received
                </button>
              )}
              {canWithdraw && (
                <button disabled={busy} onClick={() => handleAction("withdraw", "withdraw")} className={dangerTextButtonClass}>
                  Withdraw Request
                </button>
              )}
            </div>

            <PhotoGallery
              orderId={order.id}
              photos={order.photos}
              product={order.product}
              canEdit={canFulfill || isOwner}
              onChange={refresh}
            />

            <RemarksPanel
              orderId={order.id}
              remarks={order.remarks}
              currentUserId={currentUser.id}
              isAdmin={currentUser.role === "ADMIN"}
              canAdd={canFulfill || isOwner}
              onChange={refresh}
            />
          </div>
        ) : null}
      </div>

      <AcceptModal order={acceptOpen ? order : null} onClose={() => setAcceptOpen(false)} onAccepted={handleMutated} />
      <RejectOrderModal order={rejectOpen ? order : null} onClose={() => setRejectOpen(false)} onRejected={handleMutated} />
    </div>
  );
}
