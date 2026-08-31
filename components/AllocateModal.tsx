"use client";

import { useEffect, useState } from "react";
import Modal from "@/components/Modal";
import { inputClass, labelClass, primaryButtonClass } from "@/lib/formStyles";
import type { Container, RequirementDetail } from "@/lib/types";
import { CONTAINER_STATUS_LABELS } from "@/lib/types";

export default function AllocateModal({
  requirement, onClose, onDone,
}: {
  requirement: RequirementDetail | null;
  onClose: () => void;
  onDone: (r: RequirementDetail) => void;
}) {
  const [containers, setContainers] = useState<Container[]>([]);
  const [containerId, setContainerId] = useState("");
  const [qty, setQty] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const allocatable = requirement
    ? requirement.quantities.procured - requirement.quantities.allocated
    : 0;

  useEffect(() => {
    if (!requirement) return;
    fetch("/api/containers").then((r) => (r.ok ? r.json() : [])).then(setContainers);
  }, [requirement]);

  function close() { setContainerId(""); setQty(""); setError(null); onClose(); }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!requirement) return;
    setBusy(true); setError(null);
    const res = await fetch(`/api/requirements/${requirement.id}/allocate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ containerId, qty: Number(qty) }),
    });
    setBusy(false);
    if (!res.ok) return setError((await res.json().catch(() => null))?.error || "Couldn't allocate");
    onDone(await res.json());
    close();
  }

  // Loaded and beyond has already sailed; allocating into it would be a lie.
  const open = containers.filter((c) => !["LOADED", "IN_TRANSIT", "ARRIVED"].includes(c.status));

  return (
    <Modal open={!!requirement} onClose={close} title="Allocate to Container">
      {requirement && (
        <form onSubmit={submit} className="flex flex-col gap-3">
          <p className="text-sm text-black/60 dark:text-white/60">
            {requirement.product.name} · {allocatable.toLocaleString()} unit(s) procured and not yet allocated
          </p>
          {allocatable <= 0 ? (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-400/10 dark:text-amber-300">
              Confirm procurement first — only procured quantity can go into a container.
            </p>
          ) : (
            <>
              <div>
                <label className={labelClass} htmlFor="ac">Container</label>
                <select id="ac" required value={containerId} onChange={(e) => setContainerId(e.target.value)} className={inputClass}>
                  <option value="">Choose a container…</option>
                  {open.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} · {CONTAINER_STATUS_LABELS[c.status]}
                    </option>
                  ))}
                </select>
                {open.length === 0 && (
                  <p className="mt-1 text-xs text-black/50 dark:text-white/50">
                    No container is still open for loading — create one first.
                  </p>
                )}
              </div>
              <div>
                <label className={labelClass} htmlFor="aq">Quantity</label>
                <input
                  id="aq" type="number" min={1} max={allocatable} required
                  value={qty} onChange={(e) => setQty(e.target.value)} className={inputClass}
                />
              </div>
              {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
              <button type="submit" disabled={busy} className={`mt-1 w-full ${primaryButtonClass}`}>
                {busy ? "Allocating…" : "Allocate"}
              </button>
            </>
          )}
        </form>
      )}
    </Modal>
  );
}
