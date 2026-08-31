/**
 * Shipping date rules, centralised so the business rule can change in one place
 * without touching any workflow. Panda and Alice should never compute an ETA.
 */

/** Days from loading to expected arrival. The current business rule. */
export const TRANSIT_DAYS = 40;

export function expectedArrival(loadingDate: Date | null | undefined): Date | null {
  if (!loadingDate) return null;
  const eta = new Date(loadingDate);
  eta.setDate(eta.getDate() + TRANSIT_DAYS);
  return eta;
}

/**
 * Whole days from today until `date`; negative once the date has passed.
 *
 * Deliberately computed in UTC on both sides. Using local getters here makes
 * the server (UTC) and the browser (e.g. IST) land on different calendar days,
 * which renders a different number on each and breaks hydration.
 */
export function daysUntil(date: Date | string | null | undefined): number | null {
  if (!date) return null;
  const target = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(target.getTime())) return null;
  const utcDay = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return Math.round((utcDay(target) - utcDay(new Date())) / 86_400_000);
}
