import ExcelJS from "exceljs";
import { normalizeCode } from "@/lib/identifiers";

export type ParsedContainerRow = {
  rowNumber: number;
  shippingMark: string | null;
  itemNo: string | null;
  description: string | null;
  sectionLabel: string | null;
  cartons: number | null;
  qtyPerCarton: number | null;
  totalQty: number | null;
  cbm: number | null;
  totalCbm: number | null;
  weight: number | null;
  totalWeight: number | null;
  imageBuffer: Buffer | null;
  imageExtension: string | null;
};

// Columns, verified against a real "HINDU OFFICE PACKING LIST" file:
// A Pic. (embedded image, anchored per-row) | B Shipping Mark | C Item No. |
// D Description | E Ctns | F QTY/Ctn | G T-Qty | H Cbm | I Total Cbm | J WT | K Total WT
const COL = {
  shippingMark: 2,
  itemNo: 3,
  description: 4,
  cartons: 5,
  qtyPerCarton: 6,
  totalQty: 7,
  cbm: 8,
  totalCbm: 9,
  weight: 10,
  totalWeight: 11,
} as const;

/** ExcelJS returns formula cells as {formula, result} / {sharedFormula, result} objects, not plain values. */
function cellText(value: ExcelJS.CellValue): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "object") {
    if ("richText" in value) {
      return (value.richText as { text: string }[]).map((r) => r.text).join("").trim() || null;
    }
    if ("result" in value && value.result !== null && value.result !== undefined) {
      return String(value.result).trim() || null;
    }
    return null;
  }
  const s = String(value).trim();
  return s || null;
}

function cellNumber(value: ExcelJS.CellValue): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return value;
  if (typeof value === "object" && "result" in value && typeof value.result === "number") {
    return value.result;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export async function parseContainerExcel(buffer: Buffer): Promise<ParsedContainerRow[]> {
  const workbook = new ExcelJS.Workbook();
  // exceljs's bundled Buffer type and this project's @types/node Buffer resolve
  // to structurally different (but runtime-identical) generic instantiations.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await workbook.xlsx.load(buffer as any);
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error("No worksheet found in the uploaded file");

  const rowToImageId = new Map<number, number>();
  for (const entry of sheet.getImages()) {
    rowToImageId.set(entry.range.tl.nativeRow + 1, Number(entry.imageId));
  }

  const rows: ParsedContainerRow[] = [];
  let currentSection: string | null = null;

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // header row

    const shippingMark = cellText(row.getCell(COL.shippingMark).value);
    const itemNo = cellText(row.getCell(COL.itemNo).value);

    // Section-divider rows ("WAREHOUSE GOODS", "YS 15 NEW", ...) and the
    // trailing TOTAL row only have column A populated -- not real line items.
    if (!shippingMark && !itemNo) {
      const label = cellText(row.getCell(1).value);
      if (label && label.toUpperCase() !== "TOTAL") currentSection = label;
      return;
    }

    const imageId = rowToImageId.get(rowNumber);
    let imageBuffer: Buffer | null = null;
    let imageExtension: string | null = null;
    if (imageId !== undefined) {
      const img = workbook.getImage(imageId);
      if (img.buffer) {
        imageBuffer = Buffer.isBuffer(img.buffer) ? img.buffer : Buffer.from(img.buffer);
        imageExtension = img.extension;
      }
    }

    rows.push({
      rowNumber,
      shippingMark,
      itemNo,
      description: cellText(row.getCell(COL.description).value),
      sectionLabel: currentSection,
      cartons: cellNumber(row.getCell(COL.cartons).value),
      qtyPerCarton: cellNumber(row.getCell(COL.qtyPerCarton).value),
      totalQty: cellNumber(row.getCell(COL.totalQty).value),
      cbm: cellNumber(row.getCell(COL.cbm).value),
      totalCbm: cellNumber(row.getCell(COL.totalCbm).value),
      weight: cellNumber(row.getCell(COL.weight).value),
      totalWeight: cellNumber(row.getCell(COL.totalWeight).value),
      imageBuffer,
      imageExtension,
    });
  });

  return rows;
}

/** e.g. "HINDU OFFICE PACKING LIST FOR YS 15.xlsx" -> "YS15" */
export function suggestContainerName(fileName: string): string {
  const base = fileName.replace(/\.xlsx?$/i, "");
  const match = base.match(/FOR\s+(.+)$/i);
  const raw = match ? match[1] : base;
  return raw.replace(/\s+/g, "").toUpperCase();
}


/**
 * Candidate identifier codes for a row: the Item No. column as-is, any
 * alphanumeric token in the Shipping Mark that looks like a code (>=3 chars,
 * contains a digit), and a leading alphanumeric prefix from Description
 * (which sometimes mixes a code with Chinese text, e.g. "8015史迪仔").
 */
export function extractCandidateCodes(
  row: Pick<ParsedContainerRow, "shippingMark" | "itemNo" | "description">
): string[] {
  const candidates = new Set<string>();

  if (row.itemNo) candidates.add(normalizeCode(row.itemNo));

  if (row.shippingMark) {
    for (const token of row.shippingMark.split(/\s+/)) {
      if (token.length >= 3 && /\d/.test(token)) candidates.add(normalizeCode(token));
    }
  }

  if (row.description) {
    const trimmed = row.description.trim();
    const prefixMatch = trimmed.match(/^[A-Za-z0-9]+/);
    if (prefixMatch && prefixMatch[0].length >= 3) candidates.add(normalizeCode(prefixMatch[0]));
    if (/^[A-Za-z0-9]+$/.test(trimmed)) candidates.add(normalizeCode(trimmed));
  }

  return [...candidates];
}

export type IdentifierCandidate = {
  productId: string;
  /** Pre-normalised ProductIdentifier.normalizedValue. */
  normalizedValue: string;
  label: string;
};

export type ProductMatch =
  | { kind: "matched"; productId: string; matchedOn: string }
  | { kind: "ambiguous"; productIds: string[]; note: string }
  | { kind: "unmatched" };

/**
 * Resolves a manifest row against every registered product identifier -- no
 * single SKU field is privileged, which is what lets a packing-list code that
 * is a China code, a KMW ID or a marketplace SKU all find their product.
 *
 * A code is auto-attached only when it resolves to exactly one product.
 * Anything less certain becomes an exception for a human, never a guess.
 */
export function resolveProduct(
  candidates: string[],
  identifiers: IdentifierCandidate[]
): ProductMatch {
  const candidateSet = new Set(candidates);

  const exact = identifiers.filter((i) => candidateSet.has(i.normalizedValue));
  const exactProducts = [...new Set(exact.map((i) => i.productId))];

  if (exactProducts.length === 1) {
    return { kind: "matched", productId: exactProducts[0], matchedOn: exact[0].label };
  }
  if (exactProducts.length > 1) {
    return {
      kind: "ambiguous",
      productIds: exactProducts,
      note: `Code matches ${exactProducts.length} different products`,
    };
  }

  const loose = identifiers.filter((i) =>
    candidates.some(
      (c) =>
        c.length >= 3 &&
        i.normalizedValue.length >= 3 &&
        (c.includes(i.normalizedValue) || i.normalizedValue.includes(c))
    )
  );
  const looseProducts = [...new Set(loose.map((i) => i.productId))];
  if (looseProducts.length > 0) {
    return {
      kind: "ambiguous",
      productIds: looseProducts,
      note: "Only a partial code match was found -- please confirm",
    };
  }

  return { kind: "unmatched" };
}

export { normalizeCode };
