"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import StatusTabs, { type StatusFilter } from "@/components/StatusTabs";
import ShipmentCard from "@/components/ShipmentCard";
import CopyExcelButton from "@/components/CopyExcelButton";
import AddRequestModal from "@/components/AddRequestModal";
import AcceptModal from "@/components/AcceptModal";
import type { Shipment } from "@/lib/types";

export default function Home() {
  const router = useRouter();
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeStatus, setActiveStatus] = useState<StatusFilter>("ALL");
  const [addOpen, setAddOpen] = useState(false);
  const [acceptTarget, setAcceptTarget] = useState<Shipment | null>(null);

  async function refresh() {
    const res = await fetch("/api/shipments");
    if (res.ok) setShipments(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data load on mount
    refresh();
  }, []);

  const counts = useMemo(() => {
    const base: Record<StatusFilter, number> = {
      ALL: shipments.length,
      REQUESTED: 0,
      ACCEPTED: 0,
      ARRIVED: 0,
    };
    for (const s of shipments) base[s.status]++;
    return base;
  }, [shipments]);

  const filtered = useMemo(
    () => (activeStatus === "ALL" ? shipments : shipments.filter((s) => s.status === activeStatus)),
    [shipments, activeStatus]
  );

  async function handleArrive(shipment: Shipment) {
    const res = await fetch(`/api/shipments/${shipment.id}/arrive`, { method: "PATCH" });
    if (res.ok) refresh();
  }

  async function handleDelete(shipment: Shipment) {
    if (!window.confirm(`Delete "${shipment.productName}"? This can't be undone.`)) return;
    const res = await fetch(`/api/shipments/${shipment.id}`, { method: "DELETE" });
    if (res.ok) refresh();
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 pb-24 pt-6 sm:px-6">
      <header className="mb-5 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold">Transit Tracker</h1>
          <p className="text-sm text-black/50 dark:text-white/50">
            Container transit & pipeline verification
          </p>
        </div>
        <button
          onClick={handleLogout}
          className="rounded-lg px-3 py-1.5 text-sm text-black/50 hover:bg-black/5 dark:text-white/50 dark:hover:bg-white/10"
        >
          Log out
        </button>
      </header>

      <div className="mb-4">
        <StatusTabs active={activeStatus} counts={counts} onChange={setActiveStatus} />
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <CopyExcelButton shipments={shipments} />
        <button
          onClick={() => setAddOpen(true)}
          className="rounded-lg bg-black px-3.5 py-2 text-sm font-medium text-white dark:bg-white dark:text-black"
        >
          + New Request
        </button>
      </div>

      {loading ? (
        <p className="py-12 text-center text-sm text-black/40 dark:text-white/40">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="py-12 text-center text-sm text-black/40 dark:text-white/40">
          No shipments here yet.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((shipment) => (
            <ShipmentCard
              key={shipment.id}
              shipment={shipment}
              onAccept={setAcceptTarget}
              onArrive={handleArrive}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      <button
        onClick={() => setAddOpen(true)}
        aria-label="New request"
        className="fixed bottom-6 right-6 flex h-14 w-14 items-center justify-center rounded-full bg-black text-2xl text-white shadow-lg sm:hidden dark:bg-white dark:text-black"
      >
        +
      </button>

      <AddRequestModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={(shipment) => setShipments((prev) => [shipment, ...prev])}
      />

      <AcceptModal
        shipment={acceptTarget}
        onClose={() => setAcceptTarget(null)}
        onAccepted={(updated) =>
          setShipments((prev) => prev.map((s) => (s.id === updated.id ? updated : s)))
        }
      />
    </div>
  );
}
