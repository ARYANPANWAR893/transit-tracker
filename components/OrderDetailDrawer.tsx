"use client";

import { useCallback, useEffect, useState } from "react";
import type { OrderDetail, PublicUser } from "@/lib/types";
import StatusPill from "@/components/StatusPill";
import RemarksPanel from "@/components/RemarksPanel";
import PhotoGallery from "@/components/PhotoGallery";
import AcceptModal from "@/components/AcceptModal";
import AddArrivalModal from "@/components/AddArrivalModal";
import { primaryButtonClass } from "@/lib/formStyles";

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-black/40 dark:text-white/40">{label}</dt>
      <dd className="text-sm">{value}</dd>
    </div>
  );
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
  const [addArrivalOpen, setAddArrivalOpen] = useState(false);

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

  const canEdit = currentUser.role === "ADMIN" || currentUser.role === "EDITOR";

  if (!orderId) return null;

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/40">
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />
      <div className="relative flex h-full w-full max-w-lg flex-col overflow-y-auto bg-white p-5 shadow-xl dark:bg-[#111316]">
        <div className="mb-4 flex items-start justify-between">
          <div>
            {order && <h2 className="text-lg font-semibold">{order.product.name}</h2>}
            {order && (
              <p className="text-sm text-black/50 dark:text-white/50">
                MA {order.product.maSku} · KM {order.product.kmSku}
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
              <span className="text-sm text-black/50 dark:text-white/50">
                {order.qtyReceived} / {order.qty} received
              </span>
            </div>

            <dl className="grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-3">
              <Field label="Requested" value={formatDate(order.requestedDate)} />
              <Field label="Needed By" value={formatDate(order.neededByDate)} />
              <Field label="Accepted" value={formatDate(order.acceptanceDate)} />
              <Field label="Container #" value={order.containerNumber || "—"} />
              <Field label="Est. Arrival" value={formatDate(order.estArrivalDate)} />
              <Field label="Final Arrived" value={formatDate(order.finalArrivedDate)} />
              <Field label="Created by" value={order.createdBy.name} />
            </dl>

            <div className="flex flex-wrap gap-2">
              {order.status === "REQUESTED" && canEdit && (
                <button onClick={() => setAcceptOpen(true)} className={primaryButtonClass}>
                  Accept
                </button>
              )}
              {(order.status === "ACCEPTED" || order.status === "PARTIALLY_ARRIVED") && canEdit && (
                <button onClick={() => setAddArrivalOpen(true)} className={primaryButtonClass}>
                  Record Arrival
                </button>
              )}
            </div>

            {order.arrivals.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-semibold">Arrival History</h3>
                <ul className="flex flex-col gap-1.5 text-sm">
                  {order.arrivals.map((a) => (
                    <li
                      key={a.id}
                      className="flex justify-between rounded-lg border border-black/10 px-2.5 py-1.5 dark:border-white/10"
                    >
                      <span>
                        {a.qty} units{a.containerNumber ? ` · ${a.containerNumber}` : ""}
                      </span>
                      <span className="text-black/50 dark:text-white/50">
                        {formatDate(a.arrivedDate)} · {a.recordedBy.name}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <PhotoGallery
              orderId={order.id}
              photos={order.photos}
              product={order.product}
              canEdit={canEdit}
              onChange={refresh}
            />

            <RemarksPanel
              orderId={order.id}
              remarks={order.remarks}
              currentUserId={currentUser.id}
              isAdmin={currentUser.role === "ADMIN"}
              canAdd={canEdit}
              onChange={refresh}
            />
          </div>
        ) : null}
      </div>

      <AcceptModal order={acceptOpen ? order : null} onClose={() => setAcceptOpen(false)} onAccepted={handleMutated} />
      <AddArrivalModal
        order={addArrivalOpen ? order : null}
        onClose={() => setAddArrivalOpen(false)}
        onAdded={handleMutated}
      />
    </div>
  );
}
