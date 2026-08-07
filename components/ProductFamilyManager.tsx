"use client";

import { useState } from "react";
import type { ProductFamily } from "@/lib/types";
import { inputClass, primaryButtonClass } from "@/lib/formStyles";

export default function ProductFamilyManager({
  families,
  canEdit,
  onChange,
}: {
  families: ProductFamily[];
  canEdit: boolean;
  onChange: () => void;
}) {
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/product-families", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName }),
    });

    setSubmitting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error || "Failed to create family");
      return;
    }
    setNewName("");
    onChange();
  }

  async function handleRename(id: string) {
    if (!renameValue.trim()) return;
    const res = await fetch(`/api/product-families/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: renameValue }),
    });
    if (res.ok) {
      setRenamingId(null);
      onChange();
    } else {
      const body = await res.json().catch(() => null);
      setError(body?.error || "Failed to rename family");
    }
  }

  async function handleDelete(family: ProductFamily) {
    if (!window.confirm(`Delete family "${family.name}"?`)) return;
    const res = await fetch(`/api/product-families/${family.id}`, { method: "DELETE" });
    if (res.ok) {
      onChange();
    } else {
      const body = await res.json().catch(() => null);
      setError(body?.error || "Failed to delete family");
    }
  }

  return (
    <div className="rounded-2xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-white/5">
      <h2 className="mb-3 font-semibold">Product Families</h2>

      <ul className="mb-3 flex flex-col gap-1.5">
        {families.map((family) => (
          <li key={family.id} className="flex items-center justify-between gap-2 text-sm">
            {renamingId === family.id ? (
              <div className="flex flex-1 gap-2">
                <input
                  autoFocus
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  className={inputClass}
                />
                <button
                  onClick={() => handleRename(family.id)}
                  className="shrink-0 text-sm font-medium text-black dark:text-white"
                >
                  Save
                </button>
                <button
                  onClick={() => setRenamingId(null)}
                  className="shrink-0 text-sm text-black/50 dark:text-white/50"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <>
                <span>{family.name}</span>
                {canEdit && (
                  <span className="flex gap-3">
                    <button
                      onClick={() => {
                        setRenamingId(family.id);
                        setRenameValue(family.name);
                      }}
                      className="text-black/50 hover:text-black dark:text-white/50 dark:hover:text-white"
                    >
                      Rename
                    </button>
                    <button
                      onClick={() => handleDelete(family)}
                      className="text-red-600 hover:text-red-700 dark:text-red-400"
                    >
                      Delete
                    </button>
                  </span>
                )}
              </>
            )}
          </li>
        ))}
        {families.length === 0 && (
          <li className="text-sm text-black/40 dark:text-white/40">No families yet.</li>
        )}
      </ul>

      {canEdit && (
        <form onSubmit={handleCreate} className="flex gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New family name"
            className={inputClass}
          />
          <button type="submit" disabled={submitting || !newName.trim()} className={primaryButtonClass}>
            Add
          </button>
        </form>
      )}

      {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
