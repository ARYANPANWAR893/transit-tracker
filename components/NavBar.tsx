"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { PublicUser } from "@/lib/types";
import ArrivalNotificationBanner from "@/components/ArrivalNotificationBanner";

function linksFor(role: PublicUser["role"]): { href: string; label: string }[] {
  const links = [{ href: "/", label: "Orders" }, { href: "/products", label: "Products" }];
  if (role === "ORDER_ACCEPTER" || role === "ADMIN") {
    links.push({ href: "/container-uploads", label: "Container Uploads" });
  }
  if (role === "ADMIN") {
    links.push({ href: "/users", label: "Users" }, { href: "/activity-logs", label: "Activity Logs" });
  }
  return links;
}

const ROLE_LABELS: Record<PublicUser["role"], string> = {
  ADMIN: "Admin",
  ORDERER: "Orderer",
  ORDER_ACCEPTER: "Order Accepter",
};

export default function NavBar({ user }: { user: PublicUser }) {
  const pathname = usePathname();
  const router = useRouter();

  const links = linksFor(user.role);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="mb-5">
      <header className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-5">
          <div>
            <h1 className="text-xl font-semibold">OMS</h1>
            <p className="text-sm text-black/50 dark:text-white/50">China sourcing & order tracking</p>
          </div>
          <nav className="flex flex-wrap gap-1">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                  pathname === link.href
                    ? "bg-black text-white dark:bg-white dark:text-black"
                    : "text-black/60 hover:bg-black/5 dark:text-white/60 dark:hover:bg-white/10"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-sm text-black/50 dark:text-white/50">
            {user.name} · {ROLE_LABELS[user.role]}
          </span>
          <button
            onClick={handleLogout}
            className="rounded-lg px-3 py-1.5 text-sm text-black/50 hover:bg-black/5 dark:text-white/50 dark:hover:bg-white/10"
          >
            Log out
          </button>
        </div>
      </header>

      {user.role === "ORDERER" && <ArrivalNotificationBanner />}
    </div>
  );
}
