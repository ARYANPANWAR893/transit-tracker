"use client";

import { useState } from "react";
import Modal from "@/components/Modal";
import { inputClass, labelClass } from "@/lib/formStyles";
import type { RequirementDetail } from "@/lib/types";

export default function RejectRequirementModal({
  requirement, onClose, onDone,
}: {
  requirement: RequirementDetail | null;
  onClose: () => void;
  onDone: (r: RequirementDetail) => void;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function close() { setReason(""); setError(null); onClose(); }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!requirement) return;
    setBusy(true); setError(null);
    const res = await fetch(`/api/requirements/${requirement.id}/reject`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    setBusy(false);
    if (!res.ok) return setError((await res.json().catch(() => null))?.error || "Couldn't reject");
    onDone(await res.json());
    close();
  }

  return (
    <Modal open={!!requirement} onClose={close} title="Reject Requirement">
      {requirement && (
        <form onSubmit={submit} className="flex flex-col gap-3">
          <p className="text-sm text-black/60 dark:text-white/60">{requirement.product.name}</p>
          <div>
            <label className={labelClass} htmlFor="rr">Reason</label>
            <textarea
              id="rr" required autoFocus value={reason} onChange={(e) => setReason(e.target.value)}
              placeholder="This is shown to whoever raised the requirement"
              className={`${inputClass} min-h-24`}
            />
          </div>
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <button
            type="submit" disabled={busy || !reason.trim()}
            className="mt-1 w-full rounded-lg bg-red-600 px-4 py-2.5 text-base font-medium text-white hover:bg-red-700 disabled:opacity-40"
          >
            {busy ? "Rejecting…" : "Reject Requirement"}
          </button>
        </form>
      )}
    </Modal>
  );
}
