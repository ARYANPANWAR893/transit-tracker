"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { upload } from "@vercel/blob/client";
import type { ContainerDetail, ContainerItem, Product, PublicUser } from "@/lib/types";
import { CONTAINER_STATUS_LABELS } from "@/lib/types";
import { ContainerStatusPill } from "@/components/StatusPill";
import { canConfirmLoading, canManageContainers, canResolveManifestExceptions, canUploadManifest } from "@/lib/permissions";
import { daysUntil, TRANSIT_DAYS } from "@/lib/shipping";
import { inputClass, primaryButtonClass, secondaryButtonClass } from "@/lib/formStyles";
import { formatDate } from "@/lib/format";


export default function ContainerDetailClient({
  container: initial, currentUser,
}: {
  container: ContainerDetail;
  currentUser: PublicUser;
}) {
  const [c, setC] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/containers/${c.id}`);
    if (res.ok) setC(await res.json());
  }, [c.id]);

  async function patch(body: unknown, label: string) {
    setBusy(true); setError(null);
    const res = await fetch(`/api/containers/${c.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    setBusy(false);
    if (!res.ok) return setError((await res.json().catch(() => null))?.error || `Couldn't ${label}`);
    setC(await res.json());
  }

  async function uploadManifest(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setBusy(true); setError(null); setProgress("Uploading file…");
    try {
      // Straight to blob storage: these packing lists exceed the request body limit.
      const blob = await upload(file.name, file, {
        access: "public",
        handleUploadUrl: "/api/container-uploads/upload-token",
      });
      setProgress("Reading manifest…");
      const res = await fetch("/api/container-uploads", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ containerId: c.id, blobUrl: blob.url, fileName: file.name }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || "Couldn't process the manifest");
      setFile(null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false); setProgress(null);
    }
  }

  const exceptions = c.items.filter((i) => i.matchStatus !== "MATCHED");
  const days = daysUntil(c.expectedArrivalDate);

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-2xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-white/5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold">{c.code}</h1>
              <ContainerStatusPill status={c.status} />
            </div>
            <p className="mt-1 text-sm text-black/50 dark:text-white/50">
              Loading {formatDate(c.loadingDate)} · ETA {formatDate(c.expectedArrivalDate)}
              {days !== null && ` · ${days >= 0 ? `${days} days away` : `${Math.abs(days)} days ago`}`}
            </p>
            {c.loadingDate && (
              <p className="text-xs text-black/40 dark:text-white/40">
                Arrival calculated as loading + {TRANSIT_DAYS} days
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {canManageContainers(currentUser) && (
              <input
                type="date"
                value={c.loadingDate ? c.loadingDate.slice(0, 10) : ""}
                onChange={(e) => patch({ loadingDate: e.target.value || null }, "set the loading date")}
                className={`${inputClass} w-auto`}
                aria-label="Loading date"
              />
            )}
            {c.status === "LOADING" && (canConfirmLoading(currentUser) || canManageContainers(currentUser)) && (
              <button
                disabled={busy}
                onClick={() => {
                  if (window.confirm(`Confirm ${c.code} has been loaded?\n\n${c.products.length} product(s) · ${c.totalAllocatedQty.toLocaleString()} units`)) {
                    patch({ status: "LOADED" }, "confirm loading");
                  }
                }}
                className={primaryButtonClass}
              >
                Confirm Loading Complete
              </button>
            )}
            {canManageContainers(currentUser) && (
              <select
                value={c.status}
                onChange={(e) => patch({ status: e.target.value }, "change status")}
                className={`${inputClass} w-auto`}
                aria-label="Container status"
              >
                {Object.entries(CONTAINER_STATUS_LABELS).map(([v, label]) => (
                  <option key={v} value={v}>{label}</option>
                ))}
              </select>
            )}
          </div>
        </div>
        {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold">Products in this container</h2>
        {c.products.length === 0 ? (
          <p className="rounded-xl border border-dashed border-black/15 p-4 text-sm text-black/50 dark:border-white/20 dark:text-white/50">
            Nothing allocated to this container yet.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-black/10 dark:border-white/10">
            <table className="w-full text-left text-sm">
              <thead className="bg-black/[0.02] text-xs uppercase text-black/40 dark:bg-white/[0.03] dark:text-white/40">
                <tr>
                  <th className="px-3 py-2">Product</th>
                  <th className="px-3 py-2 text-right">Required</th>
                  <th className="px-3 py-2 text-right">In Container</th>
                  <th className="px-3 py-2 text-right">Remaining</th>
                </tr>
              </thead>
              <tbody>
                {c.products.map((p) => (
                  <tr key={p.productId} className="border-t border-black/5 dark:border-white/10">
                    <td className="px-3 py-2.5">
                      <Link href={`/products/${p.productId}`} className="font-medium hover:underline">{p.productName}</Link>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{p.required.toLocaleString()}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{p.inContainer.toLocaleString()}</td>
                    <td className={`px-3 py-2.5 text-right tabular-nums ${p.remaining > 0 ? "text-amber-700 dark:text-amber-400" : "text-black/40 dark:text-white/40"}`}>
                      {p.remaining.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {canUploadManifest(currentUser) && (
        <section className="rounded-2xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-white/5">
          <h2 className="mb-2 text-sm font-semibold">Packing list</h2>
          <form onSubmit={uploadManifest} className="flex flex-wrap items-center gap-2">
            <input
              type="file" accept=".xlsx,.xls"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="text-sm"
            />
            <button type="submit" disabled={!file || busy} className={primaryButtonClass}>
              {busy ? progress ?? "Working…" : "Upload & Match"}
            </button>
          </form>
          {c.uploads.length > 0 && (
            <ul className="mt-3 flex flex-col gap-1 text-sm text-black/60 dark:text-white/60">
              {c.uploads.map((u) => (
                <li key={u.id}>
                  {u.fileName} · {u.totalRows} rows · {u.matchedCount} matched, {u.ambiguousCount} ambiguous,{" "}
                  {u.unmatchedCount} unmatched
                  {u.errorMessage && <span className="text-red-600 dark:text-red-400"> · {u.errorMessage}</span>}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {c.items.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold">
            Manifest rows {exceptions.length > 0 && (
              <span className="text-amber-700 dark:text-amber-400">· {exceptions.length} need review</span>
            )}
          </h2>
          <ManifestRows
            items={c.items}
            canResolve={canResolveManifestExceptions(currentUser)}
            onResolved={refresh}
          />
        </section>
      )}
    </div>
  );
}

function ManifestRows({
  items, canResolve, onResolved,
}: {
  items: ContainerItem[];
  canResolve: boolean;
  onResolved: () => void;
}) {
  const [products, setProducts] = useState<Product[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    if (!canResolve) return;
    fetch("/api/products").then((r) => (r.ok ? r.json() : [])).then(setProducts);
  }, [canResolve]);

  async function resolve(itemId: string, body: unknown) {
    const res = await fetch(`/api/container-items/${itemId}/resolve`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    if (res.ok) { setOpenId(null); onResolved(); }
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-black/10 dark:border-white/10">
      <table className="w-full text-left text-sm">
        <thead className="bg-black/[0.02] text-xs uppercase text-black/40 dark:bg-white/[0.03] dark:text-white/40">
          <tr>
            <th className="px-3 py-2">Row</th>
            <th className="px-3 py-2">Code</th>
            <th className="px-3 py-2 text-right">Qty</th>
            <th className="px-3 py-2">Resolved to</th>
            <th className="px-3 py-2">Result</th>
          </tr>
        </thead>
        <tbody>
          {items.map((i) => (
            <tr key={i.id} className="border-t border-black/5 align-top dark:border-white/10">
              <td className="px-3 py-2.5 tabular-nums">{i.rowNumber}</td>
              <td className="px-3 py-2.5">
                <div className="font-medium">{i.itemNo || i.shippingMark || "—"}</div>
                {i.description && <div className="text-xs text-black/40 dark:text-white/40">{i.description}</div>}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums">{i.totalQty?.toLocaleString() ?? "—"}</td>
              <td className="px-3 py-2.5">
                {i.resolvedProduct ? (
                  <Link href={`/products/${i.resolvedProduct.id}`} className="hover:underline">
                    {i.resolvedProduct.name}
                  </Link>
                ) : (
                  <span className="text-black/40 dark:text-white/40">—</span>
                )}
              </td>
              <td className="px-3 py-2.5">
                <span className={
                  i.matchStatus === "MATCHED" ? "text-emerald-700 dark:text-emerald-400"
                  : i.matchStatus === "AMBIGUOUS" ? "text-amber-700 dark:text-amber-400"
                  : "text-black/50 dark:text-white/50"
                }>
                  {i.matchStatus === "MATCHED" ? "Confirmed" : i.matchStatus === "AMBIGUOUS" ? "Needs review" : i.matchStatus === "ERROR" ? "Error" : "Unmatched"}
                </span>
                {i.matchNote && <div className="text-xs text-black/40 dark:text-white/40">{i.matchNote}</div>}

                {canResolve && i.matchStatus !== "MATCHED" && (
                  openId === i.id ? (
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <select
                        defaultValue=""
                        onChange={(e) => e.target.value && resolve(i.id, { productId: e.target.value })}
                        className="rounded-md border border-black/15 bg-transparent px-1.5 py-1 text-xs dark:border-white/20"
                      >
                        <option value="">Choose the product…</option>
                        {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                      <button onClick={() => resolve(i.id, { skip: true })} className="text-xs text-black/50 hover:underline dark:text-white/50">
                        Skip
                      </button>
                      <button onClick={() => setOpenId(null)} className="text-xs text-black/40 hover:underline dark:text-white/40">
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => setOpenId(i.id)} className={`mt-1.5 ${secondaryButtonClass} !px-2 !py-1 !text-xs`}>
                      Resolve
                    </button>
                  )
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
