"use client";

import { useEffect, useState } from "react";

export default function CurrencyPreview({
  amount,
  from,
  to,
}: {
  amount: number;
  from: string;
  to: string;
}) {
  const [result, setResult] = useState<{ convertedAmount: number; rate: number; rateTimestamp: string } | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!amount || amount <= 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clearing stale result when amount becomes invalid
      setResult(null);
      setError(null);
      return;
    }
    const timeout = setTimeout(() => {
      setLoading(true);
      setError(null);
      fetch(`/api/currency/convert?amount=${amount}&from=${from}&to=${to}`)
        .then(async (res) => {
          if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || "Conversion failed");
          return res.json();
        })
        .then(setResult)
        .catch((err) => setError(err.message))
        .finally(() => setLoading(false));
    }, 400);
    return () => clearTimeout(timeout);
  }, [amount, from, to]);

  if (!amount || amount <= 0) return null;

  return (
    <p className="mt-1 text-sm text-black/50 dark:text-white/50">
      {loading && "Converting…"}
      {error && <span className="text-red-600 dark:text-red-400">{error}</span>}
      {result && !loading && !error && (
        <>
          ≈ {result.convertedAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })} {to}
          <span className="text-black/30 dark:text-white/30">
            {" "}
            (rate {result.rate} as of {result.rateTimestamp})
          </span>
        </>
      )}
    </p>
  );
}
