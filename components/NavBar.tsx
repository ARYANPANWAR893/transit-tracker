"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { PublicUser } from "@/lib/types";

const LINKS = [
  { href: "/", label: "Orders" },
  { href: "/products", label: "Products" },
];

export default function NavBar({ user }: { user: PublicUser }) {
  const pathname = usePathname();
  const router = useRouter();

  const links = user.role === "ADMIN" ? [...LINKS, { href: "/users", label: "Users" }] : LINKS;

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-5">
        <div>
          <h1 className="text-xl font-semibold">OMS</h1>
          <p className="text-sm text-black/50 dark:text-white/50">Order & inventory management</p>
        </div>
        <nav className="flex gap-1">
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
          {user.name} · {user.role}
        </span>
        <button
          onClick={handleLogout}
          className="rounded-lg px-3 py-1.5 text-sm text-black/50 hover:bg-black/5 dark:text-white/50 dark:hover:bg-white/10"
        >
          Log out
        </button>
      </div>
    </header>
  );
}
