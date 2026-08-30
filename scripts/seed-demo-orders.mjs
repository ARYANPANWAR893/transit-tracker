// Demo data: one order per lifecycle stage, for local testing only.
// Usage: DATABASE_URL=... node scripts/seed-demo-orders.mjs
import { Client } from "pg";
import { randomUUID } from "node:crypto";

const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const admin = (await client.query('SELECT id FROM "User" WHERE role = $1 LIMIT 1', ["ADMIN"])).rows[0];
if (!admin) throw new Error("No admin user found — create one first.");
const userId = admin.id;

const products = (await client.query('SELECT id, name FROM "Product" ORDER BY name LIMIT 7')).rows;
if (products.length < 7) throw new Error("Need at least 7 products — run the product import first.");

// Real live rate from the same free API the app itself uses (lib/currency.ts),
// not a guessed constant — so demo data matches what the app would actually store.
const fxRes = await fetch("https://api.frankfurter.dev/v1/latest?base=INR&symbols=CNY");
const fxData = await fxRes.json();
const RATE = fxData.rates.CNY;
console.log(`Using live INR->CNY rate: ${RATE} (as of ${fxData.date})`);
const now = Date.now();
const days = (n) => new Date(now + n * 24 * 60 * 60 * 1000);

async function insertOrder({
  product,
  status,
  qty,
  // Orderer no longer names a price on request — this stays supported (nullable,
  // still converted+logged if given) but demo data leaves it unset by default,
  // matching the real flow: price is set once by the Order Accepter.
  requestedPriceInr = null,
  neededByDateOffset,
  requestedDateOffset = -10,
  acceptedQty = null,
  acceptedPriceCny = null,
  acceptedExpectedArrivalOffset = null,
  acceptanceDateOffset = null,
  rejectionReason = null,
  rejectedOffset = null,
  withdrawnOffset = null,
  arrivedOffset = null,
  confirmedOffset = null,
}) {
  const id = randomUUID();
  const requestedPriceCny = requestedPriceInr !== null ? Math.round(requestedPriceInr * RATE * 100) / 100 : null;
  const acceptedPriceInr = acceptedPriceCny !== null ? Math.round((acceptedPriceCny / RATE) * 100) / 100 : null;

  await client.query(
    `INSERT INTO "Order" (
      id, status, "productId", qty, "requestedPriceInr", "requestedPriceCny", "requestedDate", "neededByDate",
      "createdById", "acceptedQty", "acceptedPriceCny", "acceptedPriceInr", "acceptedExpectedArrivalDate",
      "acceptanceDate", "acceptedById", "rejectionReason", "rejectedAt", "rejectedById",
      "withdrawnAt", "withdrawnById", "arrivedAt", "arrivedById", "confirmedReceivedAt", "confirmedById",
      "createdAt", "updatedAt"
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8,
      $9, $10, $11, $12, $13,
      $14, $15, $16, $17, $18,
      $19, $20, $21, $22, $23, $24,
      $7, now()
    )`,
    [
      id,
      status,
      product.id,
      qty,
      requestedPriceInr,
      requestedPriceCny,
      days(requestedDateOffset),
      days(neededByDateOffset),
      userId,
      acceptedQty,
      acceptedPriceCny,
      acceptedPriceInr,
      acceptedExpectedArrivalOffset !== null ? days(acceptedExpectedArrivalOffset) : null,
      acceptanceDateOffset !== null ? days(acceptanceDateOffset) : null,
      acceptedQty !== null ? userId : null,
      rejectionReason,
      rejectedOffset !== null ? days(rejectedOffset) : null,
      rejectionReason !== null ? userId : null,
      withdrawnOffset !== null ? days(withdrawnOffset) : null,
      withdrawnOffset !== null ? userId : null,
      arrivedOffset !== null ? days(arrivedOffset) : null,
      arrivedOffset !== null ? userId : null,
      confirmedOffset !== null ? days(confirmedOffset) : null,
      confirmedOffset !== null ? userId : null,
    ]
  );

  if (requestedPriceInr !== null) {
    await client.query(
      `INSERT INTO "CurrencyConversion" (id, "orderId", kind, "originalAmount", "originalCurrency", "convertedAmount", "convertedCurrency", rate, "rateTimestamp", "createdAt")
       VALUES ($1, $2, 'REQUEST', $3, 'INR', $4, 'CNY', $5, $6, $6)`,
      [randomUUID(), id, requestedPriceInr, requestedPriceCny, RATE, days(requestedDateOffset)]
    );
  }
  if (acceptedPriceCny !== null) {
    await client.query(
      `INSERT INTO "CurrencyConversion" (id, "orderId", kind, "originalAmount", "originalCurrency", "convertedAmount", "convertedCurrency", rate, "rateTimestamp", "createdAt")
       VALUES ($1, $2, 'ACCEPTANCE', $3, 'CNY', $4, 'INR', $5, $6, $6)`,
      [randomUUID(), id, acceptedPriceCny, acceptedPriceInr, 1 / RATE, days(acceptanceDateOffset ?? -5)]
    );
  }

  console.log(`Created ${status} order for "${product.name}"`);
}

await insertOrder({
  product: products[0],
  status: "REQUESTED",
  qty: 500,
  neededByDateOffset: 20,
  requestedDateOffset: -1,
});

await insertOrder({
  product: products[1],
  status: "ACCEPTED",
  qty: 1000,
  neededByDateOffset: 25,
  requestedDateOffset: -6,
  acceptedQty: 1000,
  acceptedPriceCny: 2.6,
  acceptedExpectedArrivalOffset: 30,
  acceptanceDateOffset: -4,
});

await insertOrder({
  product: products[2],
  status: "REJECTED",
  qty: 2000,
  neededByDateOffset: 15,
  requestedDateOffset: -8,
  rejectionReason: "MOQ not available at this price point — please revise quantity or price.",
  rejectedOffset: -6,
});

await insertOrder({
  product: products[3],
  status: "WITHDRAWN",
  qty: 300,
  neededByDateOffset: 18,
  requestedDateOffset: -7,
  withdrawnOffset: -5,
});

await insertOrder({
  product: products[4],
  status: "IN_TRANSIT",
  qty: 1500,
  neededByDateOffset: 10,
  requestedDateOffset: -20,
  acceptedQty: 1500,
  acceptedPriceCny: 2.1,
  acceptedExpectedArrivalOffset: 5,
  acceptanceDateOffset: -18,
});

await insertOrder({
  product: products[5],
  status: "ARRIVED",
  qty: 800,
  neededByDateOffset: -2,
  requestedDateOffset: -30,
  acceptedQty: 800,
  acceptedPriceCny: 4.6,
  acceptedExpectedArrivalOffset: -1,
  acceptanceDateOffset: -28,
  arrivedOffset: -1,
});

await insertOrder({
  product: products[6],
  status: "CONFIRMED_RECEIVED",
  qty: 1200,
  neededByDateOffset: -10,
  requestedDateOffset: -45,
  acceptedQty: 1200,
  acceptedPriceCny: 3.3,
  acceptedExpectedArrivalOffset: -12,
  acceptanceDateOffset: -42,
  arrivedOffset: -11,
  confirmedOffset: -10,
});

await client.end();
console.log("Done: 7 demo orders created (one per lifecycle stage).");
