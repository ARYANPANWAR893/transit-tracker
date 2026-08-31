"use client";

import { useState } from "react";
import type { Remark } from "@/lib/types";
import { inputClass, primaryButtonClass } from "@/lib/formStyles";

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function RemarksPanel({
  requirementId,
  remarks,
  currentUserId,
  isAdmin,
  canAdd,
  onChange,
}: {
  requirementId: string;
  remarks: Remark[];
  currentUserId: string;
  isAdmin: boolean;
  canAdd: boolean;
  onChange: () => void;
}) {
  const [newBody, setNewBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newBody.trim()) return;
    setSubmitting(true);
    setError(null);

    const res = await fetch(`/api/requirements/${requirementId}/remarks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: newBody }),
    });

    setSubmitting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error || "Failed to add remark");
      return;
    }
    setNewBody("");
    onChange();
  }

  async function handleSaveEdit(remarkId: string) {
    if (!editValue.trim()) return;
    const res = await fetch(`/api/requirements/${requirementId}/remarks/${remarkId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: editValue }),
    });
    if (res.ok) {
      setEditingId(null);
      onChange();
    } else {
      const body = await res.json().catch(() => null);
      setError(body?.error || "Failed to update remark");
    }
  }

  async function handleDelete(remarkId: string) {
    if (!window.confirm("Delete this remark?")) return;
    const res = await fetch(`/api/requirements/${requirementId}/remarks/${remarkId}`, { method: "DELETE" });
    if (res.ok) onChange();
  }

  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold">Remarks</h3>
      <div className="mb-3 flex flex-col gap-2">
        {remarks.map((remark) => {
          const canModify = isAdmin || remark.authorId === currentUserId;
          return (
            <div
              key={remark.id}
              className="rounded-lg border border-black/10 p-2.5 text-sm dark:border-white/10"
            >
              {editingId === remark.id ? (
                <div className="flex flex-col gap-2">
                  <textarea
                    autoFocus
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className={`${inputClass} min-h-16`}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleSaveEdit(remark.id)}
                      className="text-sm font-medium text-black dark:text-white"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="text-sm text-black/50 dark:text-white/50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="whitespace-pre-wrap">{remark.body}</p>
                  <div className="mt-1 flex items-center justify-between text-xs text-black/40 dark:text-white/40">
                    <span>
                      {remark.author.name} · {formatDateTime(remark.createdAt)}
                    </span>
                    {canModify && (
                      <span className="flex gap-2">
                        <button
                          onClick={() => {
                            setEditingId(remark.id);
                            setEditValue(remark.body);
                          }}
                          className="hover:text-black dark:hover:text-white"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(remark.id)}
                          className="text-red-600 hover:text-red-700 dark:text-red-400"
                        >
                          Delete
                        </button>
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
        {remarks.length === 0 && (
          <p className="text-sm text-black/40 dark:text-white/40">No remarks yet.</p>
        )}
      </div>

      {canAdd && (
        <form onSubmit={handleAdd} className="flex flex-col gap-2">
          <textarea
            value={newBody}
            onChange={(e) => setNewBody(e.target.value)}
            placeholder="Add a remark…"
            className={`${inputClass} min-h-16`}
          />
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={submitting || !newBody.trim()}
            className={`self-start ${primaryButtonClass}`}
          >
            Add remark
          </button>
        </form>
      )}
    </div>
  );
}
