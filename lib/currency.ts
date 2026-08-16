export type ConversionResult = {
  convertedAmount: number;
  rate: number;
  rateTimestamp: Date;
};

/**
 * Free, no-key-required FX conversion via the Frankfurter API (ECB reference rates).
 * Throws if the rate can't be fetched — callers should surface that clearly
 * rather than silently guessing a rate for a money figure.
 */
export async function convertCurrency(
  amount: number,
  from: string,
  to: string
): Promise<ConversionResult> {
  const url = `https://api.frankfurter.dev/v1/latest?base=${from}&symbols=${to}`;
  const res = await fetch(url, { cache: "no-store" });

  if (!res.ok) {
    throw new Error(`Currency conversion failed (${from} -> ${to}): HTTP ${res.status}`);
  }

  const data = (await res.json()) as { rates?: Record<string, number>; date?: string };
  const rate = data.rates?.[to];

  if (typeof rate !== "number" || !Number.isFinite(rate)) {
    throw new Error(`Currency conversion failed: no ${to} rate returned for base ${from}`);
  }

  return {
    convertedAmount: Math.round(amount * rate * 100) / 100,
    rate,
    rateTimestamp: data.date ? new Date(data.date) : new Date(),
  };
}
