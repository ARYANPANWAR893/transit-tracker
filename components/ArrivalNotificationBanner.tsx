"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function ArrivalNotificationBanner() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    fetch("/api/orders?status=ARRIVED&pageSize=1")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setCount(data.total);
      });
  }, []);

  if (count === 0) return null;

  return (
    <Link
      href="/?status=ARRIVED"
      className="mb-4 block rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900 hover:bg-amber-100 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-300 dark:hover:bg-amber-400/15"
    >
      {count === 1
        ? "Your order has arrived — has it reached you? Confirm receipt."
        : `${count} of your orders have arrived — have they reached you? Confirm receipt.`}
    </Link>
  );
}
