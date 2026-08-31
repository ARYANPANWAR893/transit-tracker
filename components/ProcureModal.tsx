"use client";

import { useState } from "react";
import Modal from "@/components/Modal";
import { inputClass, labelClass, primaryButtonClass } from "@/lib/formStyles";
import type { RequirementDetail } from "@/lib/types";

export default function ProcureModal({
  requirement, onClose, onDone,
}: {
  requirement: RequirementDetail | null;
  onClose: () => void;
  onDone: (r: RequirementDetail) => void;
}) {
  const outstanding = requirement ? requirement.quantities.required - requirement.quantities.procured : 0;
  const [qty, setQty] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function close() { setQty(""); setNotes(""); setError(null); onClose(); }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!requirement) return;
    setBusy(true); setError(null);
    const res = await fetch(`/api/requirements/${requirement.id}/procure`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ qty: Number(qty), notes: notes.trim() || undefined }),
    });
    setBusy(false);
    if (!res.ok) return setError((await res.json().catch(() => null))?.error || "Couldn't confirm procurement");
    onDone(await res.json());
    close();
  }

  return (
    <Modal open={!!requirement} onClose={close} title="Confirm Procurement">
      {requirement && (
        <form onSubmit={submit} className="flex flex-col gap-3">
          <p className="text-sm text-black/60 dark:text-white/60">
            {requirement.product.name} · {outstanding.toLocaleString()} of{" "}
            {requirement.quantities.required.toLocaleString()} still to procure
          </p>
          <div>
            <label className={labelClass} htmlFor="pq">Quantity procured</label>
            <input
              id="pq" type="number" min={1} max={outstanding} required autoFocus
              value={qty} onChange={(e) => setQty(e.target.value)} className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="pn">Notes (optional)</label>
            <textarea id="pn" value={notes} onChange={(e) => setNotes(e.target.value)} className={`${inputClass} min-h-16`} />
          </div>
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <button type="submit" disabled={busy} className={`mt-1 w-full ${primaryButtonClass}`}>
            {busy ? "Confirming…" : "Confirm Procurement"}
          </button>
        </form>
      )}
    </Modal>
  );
}
