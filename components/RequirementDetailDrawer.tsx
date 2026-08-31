"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { PublicUser, RequirementDetail } from "@/lib/types";
import { IDENTIFIER_LABELS } from "@/lib/types";
import StatusPill, { ContainerStatusPill } from "@/components/StatusPill";
import QuantityBreakdownBar from "@/components/QuantityBreakdownBar";
import RemarksPanel from "@/components/RemarksPanel";
import PhotoGallery from "@/components/PhotoGallery";
import ProcureModal from "@/components/ProcureModal";
import AllocateModal from "@/components/AllocateModal";
import RejectRequirementModal from "@/components/RejectRequirementModal";
import {
  canAllocate, canCommentOnRequirement, canConfirmProcurement, canConfirmReceipt,
  canRejectRequirement, canWithdrawRequirement,
} from "@/lib/permissions";
import { primaryButtonClass, secondaryButtonClass, dangerTextButtonClass } from "@/lib/formStyles";
import { formatDate } from "@/lib/format";


function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-black/40 dark:text-white/40">{label}</dt>
      <dd className="text-sm">{value}</dd>
    </div>
  );
}

export default function RequirementDetailDrawer({
  requirementId, onClose, currentUser, onChanged,
}: {
  requirementId: string | null;
  onClose: () => void;
  currentUser: PublicUser;
  onChanged: () => void;
}) {
  const [r, setR] = useState<RequirementDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [procureOpen, setProcureOpen] = useState(false);
  const [allocateOpen, setAllocateOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);

  const refresh = useCallback(async () => {
    if (!requirementId) return;
    setLoading(true);
    const res = await fetch(`/api/requirements/${requirementId}`);
    if (res.ok) setR(await res.json());
    setLoading(false);
  }, [requirementId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load detail when the selection changes
    if (requirementId) refresh();
    else setR(null);
  }, [requirementId, refresh]);

  function mutated(next: RequirementDetail) { setR(next); onChanged(); }

  async function act(path: string, label: string, body?: unknown) {
    if (!r) return;
    setBusy(true); setError(null);
    const res = await fetch(`/api/requirements/${r.id}/${path}`, {
      method: body ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    setBusy(false);
    if (!res.ok) return setError((await res.json().catch(() => null))?.error || `Couldn't ${label}`);
    mutated(await res.json());
  }

  if (!requirementId) return null;

  const isOwner = r?.createdById === currentUser.id;
  const canComment = r ? canCommentOnRequirement(currentUser, r) : false;
  const arrived = r?.allocations.filter((a) => a.container.status === "ARRIVED" && a.receivedQty < a.qty) ?? [];

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/40">
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />
      <div className="relative flex h-full w-full max-w-xl flex-col overflow-y-auto bg-white p-5 shadow-xl dark:bg-[#111316]">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            {r && (
              <>
                <Link href={`/products/${r.productId}`} className="text-lg font-semibold hover:underline">
                  {r.product.name}
                </Link>
                <p className="text-sm text-black/50 dark:text-white/50">
                  {r.product.identifiers.length
                    ? r.product.identifiers.map((i) => `${IDENTIFIER_LABELS[i.type]} ${i.value}`).join(" · ")
                    : "No identifiers on file"}
                  {r.product.family && ` · ${r.product.family.name}`}
                </p>
              </>
            )}
          </div>
          <button
            onClick={onClose} aria-label="Close"
            className="rounded-full p-1.5 text-black/50 hover:bg-black/5 dark:text-white/50 dark:hover:bg-white/10"
          >
            ✕
          </button>
        </div>

        {loading && !r ? (
          <p className="text-sm text-black/40 dark:text-white/40">Loading…</p>
        ) : r ? (
          <div className="flex flex-col gap-5">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill status={r.fulfilmentStatus} />
              {isOwner && <span className="text-xs text-black/40 dark:text-white/40">Your requirement</span>}
            </div>

            <QuantityBreakdownBar q={r.quantities} />

            <dl className="grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-3">
              <Field label="Raised" value={formatDate(r.requestedDate)} />
              <Field label="Needed by" value={formatDate(r.neededByDate)} />
              <Field label="Raised by" value={r.createdBy.name} />
            </dl>

            {r.status === "REJECTED" && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm dark:border-red-500/20 dark:bg-red-500/10">
                <p className="font-medium text-red-800 dark:text-red-300">
                  Rejected by {r.rejectedBy?.name} on {formatDate(r.rejectedAt)}
                </p>
                <p className="mt-1 text-red-700 dark:text-red-400">{r.rejectionReason}</p>
              </div>
            )}
            {r.status === "WITHDRAWN" && (
              <p className="text-sm text-black/50 dark:text-white/50">
                Withdrawn by {r.withdrawnBy?.name} on {formatDate(r.withdrawnAt)}
              </p>
            )}

            {r.procurements.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-semibold">Procurement</h3>
                <ul className="flex flex-col gap-1.5 text-sm">
                  {r.procurements.map((p) => (
                    <li key={p.id} className="rounded-lg border border-black/10 px-2.5 py-1.5 dark:border-white/10">
                      <span className="tabular-nums font-medium">{p.qty.toLocaleString()}</span> confirmed by{" "}
                      {p.confirmedBy.name} · {formatDate(p.confirmedAt)}
                      {p.notes && <span className="block text-xs text-black/50 dark:text-white/50">{p.notes}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {r.allocations.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-semibold">Containers</h3>
                <ul className="flex flex-col gap-1.5 text-sm">
                  {r.allocations.map((a) => (
                    <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-black/10 px-2.5 py-1.5 dark:border-white/10">
                      <span className="flex items-center gap-2">
                        <Link href={`/containers/${a.containerId}`} className="font-medium hover:underline">
                          {a.container.code}
                        </Link>
                        <ContainerStatusPill status={a.container.status} />
                      </span>
                      <span className="text-black/60 dark:text-white/60">
                        <span className="tabular-nums">{a.qty.toLocaleString()}</span> allocated
                        {a.receivedQty > 0 && <> · <span className="tabular-nums">{a.receivedQty.toLocaleString()}</span> received</>}
                        {a.container.expectedArrivalDate && <> · ETA {formatDate(a.container.expectedArrivalDate)}</>}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

            <div className="flex flex-wrap gap-2">
              {canConfirmProcurement(currentUser) && r.status === "REQUESTED" && r.quantities.outstanding > 0 && (
                <button onClick={() => setProcureOpen(true)} className={primaryButtonClass}>Confirm Procurement</button>
              )}
              {canAllocate(currentUser) && r.quantities.procured > r.quantities.allocated && (
                <button onClick={() => setAllocateOpen(true)} className={secondaryButtonClass}>Allocate to Container</button>
              )}
              {canRejectRequirement(currentUser, r) && (
                <button
                  onClick={() => setRejectOpen(true)}
                  className="rounded-lg bg-red-600 px-4 py-2.5 text-base font-medium text-white hover:bg-red-700"
                >
                  Reject
                </button>
              )}
              {canConfirmReceipt(currentUser, r) &&
                arrived.map((a) => (
                  <button
                    key={a.id}
                    disabled={busy}
                    onClick={() => act("confirm-receipt", "confirm receipt", { allocationId: a.id })}
                    className={primaryButtonClass}
                  >
                    Confirm Receipt · {a.container.code}
                  </button>
                ))}
              {canWithdrawRequirement(currentUser, r) && (
                <button disabled={busy} onClick={() => act("withdraw", "withdraw")} className={dangerTextButtonClass}>
                  Withdraw
                </button>
              )}
            </div>

            <PhotoGallery
              requirementId={r.id}
              photos={r.photos}
              product={r.product}
              canEdit={canComment}
              onChange={refresh}
            />

            <RemarksPanel
              requirementId={r.id}
              remarks={r.remarks}
              currentUserId={currentUser.id}
              isAdmin={currentUser.role === "ADMIN"}
              canAdd={canComment}
              onChange={refresh}
            />
          </div>
        ) : null}
      </div>

      <ProcureModal requirement={procureOpen ? r : null} onClose={() => setProcureOpen(false)} onDone={mutated} />
      <AllocateModal requirement={allocateOpen ? r : null} onClose={() => setAllocateOpen(false)} onDone={mutated} />
      <RejectRequirementModal requirement={rejectOpen ? r : null} onClose={() => setRejectOpen(false)} onDone={mutated} />
    </div>
  );
}
