/**
 * Date formatting must be deterministic: the same string has to come out of the
 * server render and the browser hydration, or React reports a mismatch. Both
 * the locale and the time zone are pinned for that reason -- leaving them to
 * the environment is what causes the mismatch.
 */
const DATE_FORMAT = new Intl.DateTimeFormat("en-GB", {
  day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
});

const DATE_TIME_FORMAT = new Intl.DateTimeFormat("en-GB", {
  day: "numeric", month: "short", year: "numeric",
  hour: "numeric", minute: "2-digit", timeZone: "UTC",
});

export function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  return Number.isNaN(d.getTime()) ? "—" : DATE_FORMAT.format(d);
}

export function formatDateTime(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  return Number.isNaN(d.getTime()) ? "—" : DATE_TIME_FORMAT.format(d);
}
