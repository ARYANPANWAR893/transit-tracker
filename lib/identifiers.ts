import type { IdentifierType } from "@/lib/types";

/**
 * Codes are compared with punctuation and case removed, so "YS-20206",
 * "ys 20206" and "YS20206" are the same identifier. Kept in its own module so
 * request paths can normalise without pulling in the Excel parser.
 */
export function normalizeCode(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export const IDENTIFIER_TYPES: IdentifierType[] = [
  "KMW", "KATTYMAO_SKU", "MA_SKU", "CHINA_CODE",
  "AMAZON_SKU", "AMAZON_ASIN", "FLIPKART_SKU", "FLIPKART_ASIN",
  "MEESHO_SKU", "MEESHO_PRODUCT_ID",
];

export function isIdentifierType(v: unknown): v is IdentifierType {
  return typeof v === "string" && (IDENTIFIER_TYPES as string[]).includes(v);
}

/** Clean a submitted identifier list into rows ready for ProductIdentifier. */
export function toIdentifierRows(
  raw: unknown
): { type: IdentifierType; value: string; normalizedValue: string }[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const rows: { type: IdentifierType; value: string; normalizedValue: string }[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const { type, value } = entry as { type?: unknown; value?: unknown };
    if (!isIdentifierType(type) || typeof value !== "string") continue;
    // One ERP cell can hold several codes ("A-1, B-2") -- store them separately.
    for (const part of value.split(",")) {
      const trimmed = part.trim();
      const normalizedValue = normalizeCode(trimmed);
      if (!trimmed || !normalizedValue) continue;
      const key = `${type}:${trimmed}`;
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push({ type, value: trimmed, normalizedValue });
    }
  }
  return rows;
}
