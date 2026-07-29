"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    setSubmitting(false);

    if (!res.ok) {
      setError("Incorrect password");
      return;
    }

    router.push(searchParams.get("from") || "/");
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-sm rounded-2xl border border-black/10 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/5"
    >
      <h1 className="mb-1 text-xl font-semibold">Transit Tracker</h1>
      <p className="mb-6 text-sm text-black/60 dark:text-white/60">
        Enter the shared password to continue.
      </p>

      <label htmlFor="password" className="mb-1 block text-sm font-medium">
        Password
      </label>
      <input
        id="password"
        type="password"
        autoFocus
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="mb-3 w-full rounded-lg border border-black/15 bg-transparent px-3 py-2.5 text-base outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/40"
        placeholder="••••••••"
      />

      {error && <p className="mb-3 text-sm text-red-600 dark:text-red-400">{error}</p>}

      <button
        type="submit"
        disabled={submitting || !password}
        className="w-full rounded-lg bg-black px-4 py-2.5 text-base font-medium text-white disabled:opacity-40 dark:bg-white dark:text-black"
      >
        {submitting ? "Checking…" : "Enter"}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh flex-1 items-center justify-center p-4">
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
