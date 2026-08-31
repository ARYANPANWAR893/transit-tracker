"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { PublicUser } from "@/lib/types";
import { ROLE_LABELS } from "@/lib/types";

/** Panda and Alice work from containers, not the whole catalogue. */
function linksFor(role: PublicUser["role"]): { href: string; label: string }[] {
  switch (role) {
    case "REQUIREMENT_OWNER":
      return [
        { href: "/", label: "My Requirements" },
        { href: "/products", label: "Products" },
      ];
    case "PROCUREMENT_OWNER":
      return [
        { href: "/", label: "Requirements" },
        { href: "/products", label: "Products" },
        { href: "/containers", label: "Containers" },
      ];
    case "SOURCING_COORDINATOR":
      return [
        { href: "/containers", label: "Containers" },
        { href: "/", label: "Requirements" },
        { href: "/products", label: "Products" },
      ];
    case "LOADING_COORDINATOR":
      return [{ href: "/containers", label: "Containers" }];
    default:
      return [
        { href: "/", label: "Requirements" },
        { href: "/products", label: "Products" },
        { href: "/containers", label: "Containers" },
        { href: "/users", label: "Users" },
        { href: "/activity-logs", label: "Activity" },
      ];
  }
}

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
      <header className="mb-3 flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-semibold">KM Sourcing</h1>
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
      </header>
    </div>
  );
}
