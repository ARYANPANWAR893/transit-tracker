// Generates a sample container packing list (.xlsx) matching the structure of
// the real "HINDU OFFICE PACKING LIST" files, for testing the container import.
//
// Layout, per lib/excelImport.ts:
//   A Pic. | B Shipping Mark | C Item No. | D Description | E Ctns
//   F QTY/Ctn | G T-Qty | H Cbm | I Total Cbm | J WT | K Total WT
//
// Deliberately includes section-divider rows, a TOTAL row, embedded per-row
// images, and rows designed to land in each match outcome.
//
// Usage: node scripts/make-sample-container.mjs [outputPath]

import ExcelJS from "exceljs";
import zlib from "node:zlib";
import { Buffer } from "node:buffer";

const out = process.argv[2] ?? "sample-container-YS16.xlsx";

/** Build a tiny solid-colour PNG so rows carry real embedded images. */
function png(w, h, [r, g, b]) {
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(zlib.crc32 ? zlib.crc32(body) >>> 0 : crc32(body));
    return Buffer.concat([len, body, crc]);
  };
  // Node <20 lacks zlib.crc32; implement it so this script is portable.
  function crc32(buf) {
    let c, crc = 0xffffffff;
    for (let n = 0; n < buf.length; n++) {
      c = (crc ^ buf[n]) & 0xff;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crc = (crc >>> 8) ^ c;
    }
    return (crc ^ 0xffffffff) >>> 0;
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8-bit RGB
  const raw = Buffer.concat(
    Array.from({ length: h }, () => Buffer.concat([Buffer.from([0]), Buffer.concat(Array.from({ length: w }, () => Buffer.from([r, g, b])))]))
  );
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const wb = new ExcelJS.Workbook();
const sheet = wb.addWorksheet("PACKING LIST");

sheet.addRow(["Pic.", "Shipping Mark", "Item No.", "Description", "Ctns", "QTY/Ctn", "T-Qty", "Cbm", "Total Cbm", "WT", "Total WT"]);
sheet.getColumn(1).width = 12;
sheet.getColumn(2).width = 26;
sheet.getColumn(4).width = 22;

const rows = [
  // section divider — only column A populated
  { section: "WAREHOUSE GOODS" },

  // EXACT match: Item No. equals a MASKU on an ACCEPTED order, qty agrees
  { mark: "PN YS 20206 GUN", itemNo: "YS-20206", desc: "8015 blanket", ctns: 10, per: 25, qty: 250, colour: [0x33, 0x77, 0xcc], note: "exact match, qty agrees" },

  // EXACT match via the shipping-mark token, but qty DISAGREES with acceptedQty
  { mark: "PN YS-AE012 BLUE", itemNo: "", desc: "AE012 lunch box", ctns: 20, per: 40, qty: 800, colour: [0x22, 0xaa, 0x66], note: "exact match, qty mismatch (accepted 1000)" },

  { section: "YS 16 NEW" },

  // FUZZY: partial overlap with YS-20206 -> must be flagged, never auto-matched
  { mark: "PN YS 20206X RED", itemNo: "YS-20206X", desc: "variant sku", ctns: 5, per: 30, qty: 150, colour: [0xdd, 0x88, 0x22], note: "fuzzy/partial -> ambiguous" },

  // UNMATCHED: no relation to any accepted order
  { mark: "PN ZZ 99999 BLK", itemNo: "ZZ-99999", desc: "unknown item", ctns: 8, per: 12, qty: 96, colour: [0x99, 0x44, 0xbb], note: "no candidate -> unmatched" },

  // row with NO image, to prove images are optional
  { mark: "PN YS 55555 WHT", itemNo: "YS-55555", desc: "no photo item", ctns: 3, per: 10, qty: 30, colour: null, note: "unmatched, no image" },
];

let totalQty = 0, totalCtns = 0;
for (const r of rows) {
  if (r.section) { sheet.addRow([r.section]); continue; }
  const cbm = 0.045, wt = 9.5;
  const added = sheet.addRow(["", r.mark, r.itemNo, r.desc, r.ctns, r.per, r.qty, cbm, +(cbm * r.ctns).toFixed(3), wt, +(wt * r.ctns).toFixed(2)]);
  added.height = 48;
  totalQty += r.qty; totalCtns += r.ctns;

  if (r.colour) {
    const imageId = wb.addImage({ buffer: png(24, 24, r.colour), extension: "png" });
    // Anchor into column A of this row; parser maps range.tl.nativeRow + 1 -> row number.
    sheet.addImage(imageId, {
      tl: { col: 0, row: added.number - 1 },
      ext: { width: 46, height: 46 },
    });
  }
}

// trailing TOTAL row — must be skipped, not treated as a line item
sheet.addRow(["TOTAL", "", "", "", totalCtns, "", totalQty]);

await wb.xlsx.writeFile(out);
console.log(`Wrote ${out}`);
console.log(`  data rows: ${rows.filter((r) => !r.section).length}`);
console.log(`  with images: ${rows.filter((r) => r.colour).length}`);
console.log(`  section dividers: ${rows.filter((r) => r.section).length} + 1 TOTAL row`);
