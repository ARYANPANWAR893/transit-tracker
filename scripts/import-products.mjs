// One-off product import from "Auto Stock reconciliation ERP - temp2.csv".
// Usage: DATABASE_URL=... node scripts/import-products.mjs <csv-path>
// Idempotent: upserts Product by kmwId, ProductFamily by name. Bulk (single round-trip
// per table) since a per-row loop over a remote DB is too slow for ~700 rows.

import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { Client } from "pg";

const csvPath = process.argv[2];
if (!csvPath) {
  console.error("Usage: node scripts/import-products.mjs <csv-path>");
  process.exit(1);
}

// Minimal RFC4180 CSV parser (handles quoted fields containing commas).
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c === "\r") {
      // skip
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

const raw = readFileSync(csvPath, "utf-8").replace(/^﻿/, "");
const rows = parseCsv(raw);
const header = rows[0];
const dataRows = rows.slice(1).filter((r) => r.some((c) => c.trim()));

function col(row, name) {
  const idx = header.indexOf(name);
  if (idx === -1) return "";
  return (row[idx] ?? "").trim();
}

const rawRecords = [];
const familyNameCounts = new Map(); // lowercase -> Map(exactCasing -> count)
for (const row of dataRows) {
  const kmwId = col(row, "KMW SKU ID");
  if (!kmwId) continue;
  const amazonAsin = col(row, "Amazon ASINs") || col(row, "Parent ASIN") || null;
  const amazonSku = col(row, "Amazon SKUs") || null;
  const flipkartSku = col(row, "Flipkart SKUs") || null;
  const meeshoSku = col(row, "Meesho SKUs") || null;
  const meeshoProductId = col(row, "Meesho Product IDs") || null;
  const internalName = col(row, "Internal Name") || null;
  if (internalName) {
    const key = internalName.toLowerCase();
    if (!familyNameCounts.has(key)) familyNameCounts.set(key, new Map());
    const variants = familyNameCounts.get(key);
    variants.set(internalName, (variants.get(internalName) ?? 0) + 1);
  }
  rawRecords.push({ kmwId, amazonAsin, amazonSku, flipkartSku, meeshoSku, meeshoProductId, internalName });
}

// Family names that differ only by case (e.g. "Football Bottles" vs "Football bottles")
// are merged into a single family, using whichever exact casing occurs most often.
const canonicalNameByLower = new Map();
for (const [lower, variants] of familyNameCounts) {
  const [bestName] = [...variants.entries()].sort((a, b) => b[1] - a[1])[0];
  canonicalNameByLower.set(lower, bestName);
}

const records = rawRecords.map((r) => {
  const internalName = r.internalName ? canonicalNameByLower.get(r.internalName.toLowerCase()) : null;
  return { ...r, internalName, name: internalName || r.kmwId };
});
const familyNames = new Set(records.map((r) => r.internalName).filter(Boolean));

const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

try {
  await client.query("BEGIN");

  // 1. Bulk-upsert families. Case-insensitive match against names already in the DB
  // (e.g. a family created earlier by hand) so we don't spawn a case-variant duplicate.
  // If the DB already has >1 row for the same lowercase name (from before this script
  // enforced case-insensitivity), merge them deterministically: keep whichever has the
  // most products, reassign the rest, and delete the now-empty duplicates.
  const famNamesArr = [...familyNames];
  const existingFamRows = famNamesArr.length
    ? (
        await client.query(
          `SELECT f.id, f.name, count(p.id)::int AS product_count
           FROM "ProductFamily" f
           LEFT JOIN "Product" p ON p."familyId" = f.id
           WHERE lower(f.name) = ANY($1::text[])
           GROUP BY f.id, f.name`,
          [famNamesArr.map((n) => n.toLowerCase())]
        )
      ).rows
    : [];
  const byLower = new Map();
  for (const r of existingFamRows) {
    const key = r.name.toLowerCase();
    if (!byLower.has(key)) byLower.set(key, []);
    byLower.get(key).push(r);
  }
  const familyIdByName = new Map();
  for (const [key, group] of byLower) {
    group.sort((a, b) => b.product_count - a.product_count);
    const [winner, ...losers] = group;
    familyIdByName.set(key, winner.id);
    for (const loser of losers) {
      await client.query('UPDATE "Product" SET "familyId" = $1 WHERE "familyId" = $2', [winner.id, loser.id]);
      await client.query('DELETE FROM "ProductFamily" WHERE id = $1', [loser.id]);
    }
  }

  const toCreate = famNamesArr.filter((n) => !familyIdByName.has(n.toLowerCase()));
  if (toCreate.length) {
    const newIds = toCreate.map(() => randomUUID());
    await client.query(
      `INSERT INTO "ProductFamily" (id, name, "updatedAt")
       SELECT id, name, now() FROM unnest($1::text[], $2::text[]) AS t(id, name)
       ON CONFLICT (name) DO NOTHING`,
      [newIds, toCreate]
    );
    const created = (
      await client.query('SELECT id, name FROM "ProductFamily" WHERE name = ANY($1::text[])', [toCreate])
    ).rows;
    for (const r of created) familyIdByName.set(r.name.toLowerCase(), r.id);
  }
  const famRows = famNamesArr.map((n) => ({ name: n, id: familyIdByName.get(n.toLowerCase()) }));

  // 2. Bulk-upsert products by kmwId.
  const ids = records.map(() => randomUUID());
  const names = records.map((r) => r.name);
  const amazonSkus = records.map((r) => r.amazonSku);
  const amazonAsins = records.map((r) => r.amazonAsin);
  const flipkartSkus = records.map((r) => r.flipkartSku);
  const meeshoSkus = records.map((r) => r.meeshoSku);
  const meeshoProductIds = records.map((r) => r.meeshoProductId);
  const kmwIds = records.map((r) => r.kmwId);
  const familyIds = records.map((r) => (r.internalName ? familyIdByName.get(r.internalName.toLowerCase()) : null));

  const beforeCount = (await client.query('SELECT count(*)::int AS n FROM "Product"')).rows[0].n;

  await client.query(
    `INSERT INTO "Product"
      (id, name, "amazonSku", "amazonAsin", "flipkartSku", "meeshoSku", "meeshoProductId", "maSku", "kmwId", "familyId", "createdAt", "updatedAt")
     SELECT id, name, "amazonSku", "amazonAsin", "flipkartSku", "meeshoSku", "meeshoProductId", NULL, "kmwId", "familyId", now(), now()
     FROM unnest(
       $1::text[], $2::text[], $3::text[], $4::text[], $5::text[], $6::text[], $7::text[], $8::text[], $9::text[]
     ) AS t(id, name, "amazonSku", "amazonAsin", "flipkartSku", "meeshoSku", "meeshoProductId", "kmwId", "familyId")
     ON CONFLICT ("kmwId") DO UPDATE SET
       name = EXCLUDED.name,
       "amazonSku" = EXCLUDED."amazonSku",
       "amazonAsin" = EXCLUDED."amazonAsin",
       "flipkartSku" = EXCLUDED."flipkartSku",
       "meeshoSku" = EXCLUDED."meeshoSku",
       "meeshoProductId" = EXCLUDED."meeshoProductId",
       "familyId" = COALESCE(EXCLUDED."familyId", "Product"."familyId"),
       "updatedAt" = now()`,
    [ids, names, amazonSkus, amazonAsins, flipkartSkus, meeshoSkus, meeshoProductIds, kmwIds, familyIds]
  );

  const afterCount = (await client.query('SELECT count(*)::int AS n FROM "Product"')).rows[0].n;

  await client.query("COMMIT");

  console.log(`Rows processed: ${records.length}`);
  console.log(`Distinct families referenced: ${famRows.length}`);
  console.log(`Products before: ${beforeCount}, after: ${afterCount} (created: ${afterCount - beforeCount}, updated: ${records.length - (afterCount - beforeCount)})`);
} catch (err) {
  await client.query("ROLLBACK");
  throw err;
} finally {
  await client.end();
}
