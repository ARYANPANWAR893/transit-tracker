import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import { toPublicUser } from "@/lib/publicUser";
import { prisma } from "@/lib/prisma";
import { aggregate } from "@/lib/quantities";
import { PRODUCT_INCLUDE, REQUIREMENT_LIST_INCLUDE } from "@/lib/requirementSerializer";
import { daysUntil } from "@/lib/shipping";
import NavBar from "@/components/NavBar";
import QuantityBreakdownBar from "@/components/QuantityBreakdownBar";
import { ContainerStatusPill } from "@/components/StatusPill";
import { IDENTIFIER_LABELS } from "@/lib/types";
import { formatDate } from "@/lib/format";


/** "Where is this product?" — the Product -> Containers direction. */
export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const publicUser = toPublicUser(user);

  const { id } = await params;
  const product = await prisma.product.findUnique({ where: { id }, include: PRODUCT_INCLUDE });
  if (!product) notFound();

  const requirements = await prisma.requirement.findMany({
    where: { productId: id, ...(user.role === "REQUIREMENT_OWNER" ? { createdById: user.id } : {}) },
    include: REQUIREMENT_LIST_INCLUDE,
    orderBy: { createdAt: "desc" },
  });

  const quantities = aggregate(requirements);

  const byContainer = new Map<string, {
    id: string; code: string; qty: number; received: number;
    loadingDate: Date | null; eta: Date | null; status: string;
  }>();
  for (const r of requirements) {
    if (r.status !== "REQUESTED") continue;
    for (const a of r.allocations) {
      const line = byContainer.get(a.containerId) ?? {
        id: a.containerId, code: a.container.code, qty: 0, received: 0,
        loadingDate: a.container.loadingDate, eta: a.container.expectedArrivalDate,
        status: a.container.status,
      };
      line.qty += a.qty;
      line.received += a.receipts.reduce((s, x) => s + x.qty, 0);
      byContainer.set(a.containerId, line);
    }
  }
  const containers = [...byContainer.values()].sort(
    (a, b) => (a.loadingDate?.getTime() ?? 0) - (b.loadingDate?.getTime() ?? 0)
  );

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 pb-24 pt-6 sm:px-6">
      <NavBar user={publicUser} />

      <div className="mb-5">
        <h1 className="text-2xl font-semibold">{product.name}</h1>
        <p className="mt-1 text-sm text-black/50 dark:text-white/50">
          {product.identifiers.length
            ? product.identifiers.map((i) => `${IDENTIFIER_LABELS[i.type as keyof typeof IDENTIFIER_LABELS]} ${i.value}`).join(" · ")
            : "No identifiers on file"}
          {product.family && ` · ${product.family.name}`}
        </p>
      </div>

      <section className="mb-6 rounded-2xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-white/5">
        <h2 className="mb-3 text-sm font-semibold">Quantity overview</h2>
        <QuantityBreakdownBar q={quantities} />
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-sm font-semibold">Containers carrying this product</h2>
        {containers.length === 0 ? (
          <p className="rounded-xl border border-dashed border-black/15 p-4 text-sm text-black/50 dark:border-white/20 dark:text-white/50">
            Nothing allocated to a container yet.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-black/10 dark:border-white/10">
            <table className="w-full text-left text-sm">
              <thead className="bg-black/[0.02] text-xs uppercase text-black/40 dark:bg-white/[0.03] dark:text-white/40">
                <tr>
                  <th className="px-3 py-2">Container</th>
                  <th className="px-3 py-2 text-right">Qty</th>
                  <th className="px-3 py-2 text-right">Received</th>
                  <th className="px-3 py-2">Loading</th>
                  <th className="px-3 py-2">ETA</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {containers.map((c) => {
                  const days = daysUntil(c.eta);
                  return (
                    <tr key={c.id} className="border-t border-black/5 dark:border-white/10">
                      <td className="px-3 py-2.5">
                        <Link href={`/containers/${c.id}`} className="font-medium hover:underline">{c.code}</Link>
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{c.qty.toLocaleString()}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{c.received.toLocaleString()}</td>
                      <td className="px-3 py-2.5">{formatDate(c.loadingDate)}</td>
                      <td className="px-3 py-2.5">
                        {formatDate(c.eta)}
                        {days !== null && (
                          <span className="ml-1 text-xs text-black/40 dark:text-white/40">
                            {days >= 0 ? `· ${days}d` : `· ${Math.abs(days)}d ago`}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <ContainerStatusPill status={c.status as never} />
                      </td>
                    </tr>
                  );
                })}
                <tr className="border-t border-black/10 bg-black/[0.02] font-medium dark:border-white/10 dark:bg-white/[0.03]">
                  <td className="px-3 py-2.5">Total</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {containers.reduce((s, c) => s + c.qty, 0).toLocaleString()}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {containers.reduce((s, c) => s + c.received, 0).toLocaleString()}
                  </td>
                  <td colSpan={3} />
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold">Requirements ({requirements.length})</h2>
        <ul className="flex flex-col gap-1.5 text-sm">
          {requirements.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-black/10 px-3 py-2 dark:border-white/10">
              <span>
                <span className="tabular-nums font-medium">{r.requiredQty.toLocaleString()}</span> required ·{" "}
                {r.createdBy.name}
              </span>
              <span className="text-black/50 dark:text-white/50">
                needed {formatDate(r.neededByDate)}
              </span>
            </li>
          ))}
          {requirements.length === 0 && (
            <li className="text-black/40 dark:text-white/40">No requirements for this product.</li>
          )}
        </ul>
      </section>
    </div>
  );
}
