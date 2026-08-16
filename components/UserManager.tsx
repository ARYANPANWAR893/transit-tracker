"use client";

import { useEffect, useState } from "react";
import type { PublicUser, Role } from "@/lib/types";
import { inputClass, labelClass, primaryButtonClass } from "@/lib/formStyles";

const ROLES: Role[] = ["ADMIN", "ORDERER", "ORDER_ACCEPTER"];

export default function UserManager({ currentUserId }: { currentUserId: string }) {
  const [users, setUsers] = useState<PublicUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("ORDERER");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function refresh() {
    const res = await fetch("/api/users");
    if (res.ok) setUsers(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data load on mount
    refresh();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, role }),
    });

    setSubmitting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error || "Failed to create user");
      return;
    }

    setName("");
    setEmail("");
    setPassword("");
    setRole("ORDERER");
    setShowForm(false);
    refresh();
  }

  async function handleRoleChange(id: string, newRole: Role) {
    const res = await fetch(`/api/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: newRole }),
    });
    if (res.ok) refresh();
    else {
      const body = await res.json().catch(() => null);
      alert(body?.error || "Failed to update role");
    }
  }

  async function handleToggleActive(id: string, isActive: boolean) {
    const res = await fetch(`/api/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive }),
    });
    if (res.ok) refresh();
    else {
      const body = await res.json().catch(() => null);
      alert(body?.error || "Failed to update user");
    }
  }

  async function handleDelete(user: PublicUser) {
    if (!window.confirm(`Delete user "${user.name}"?`)) return;
    const res = await fetch(`/api/users/${user.id}`, { method: "DELETE" });
    if (res.ok) {
      refresh();
    } else {
      const body = await res.json().catch(() => null);
      alert(body?.error || "Failed to delete user");
    }
  }

  if (loading) {
    return <p className="py-12 text-center text-sm text-black/40 dark:text-white/40">Loading…</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Users</h2>
        <button onClick={() => setShowForm((v) => !v)} className={primaryButtonClass}>
          {showForm ? "Cancel" : "+ User"}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="grid grid-cols-1 gap-3 rounded-2xl border border-black/10 p-4 sm:grid-cols-2 dark:border-white/10"
        >
          <div>
            <label className={labelClass}>Name</label>
            <input required value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Temporary password</label>
            <input
              type="text"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Role</label>
            <select value={role} onChange={(e) => setRole(e.target.value as Role)} className={inputClass}>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          {error && <p className="text-sm text-red-600 sm:col-span-2 dark:text-red-400">{error}</p>}
          <button type="submit" disabled={submitting} className={`${primaryButtonClass} sm:col-span-2`}>
            {submitting ? "Creating…" : "Create user"}
          </button>
        </form>
      )}

      <div className="overflow-x-auto rounded-2xl border border-black/10 dark:border-white/10">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="bg-black/[0.02] text-xs uppercase text-black/40 dark:bg-white/[0.03] dark:text-white/40">
            <tr>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Role</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-t border-black/5 dark:border-white/10">
                <td className="px-3 py-2">{user.name}</td>
                <td className="px-3 py-2">{user.email}</td>
                <td className="px-3 py-2">
                  <select
                    value={user.role}
                    onChange={(e) => handleRoleChange(user.id, e.target.value as Role)}
                    disabled={user.id === currentUserId}
                    className="rounded-md border border-black/15 bg-transparent px-1.5 py-1 text-sm disabled:opacity-40 dark:border-white/20"
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2">
                  <button
                    onClick={() => handleToggleActive(user.id, !user.isActive)}
                    disabled={user.id === currentUserId}
                    className="disabled:opacity-40"
                  >
                    {user.isActive ? "Active" : "Deactivated"}
                  </button>
                </td>
                <td className="px-3 py-2 text-right">
                  {user.id !== currentUserId && (
                    <button
                      onClick={() => handleDelete(user)}
                      className="text-red-600 hover:text-red-700 dark:text-red-400"
                    >
                      Delete
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
