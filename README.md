# OMS — Order & Inventory Management System

A tabular dashboard for tracking orders through **Requested → Accepted → Partially Arrived → Arrived**, with product/family master data, per-order remarks, a photo review gallery (falls back to MA SKU / KM SKU when there's no photo), individual user accounts with roles, and one-click "Copy Excel" for everything still in transit.

## Stack

- Next.js (App Router) + TypeScript + Tailwind
- Prisma + Postgres
- Individual accounts (bcrypt-hashed passwords, DB-backed sessions) with `ADMIN` / `EDITOR` / `VIEWER` roles
- Vercel Blob for photo storage

## Local development

1. Install dependencies:
   ```bash
   npm install
   ```
2. Get a free Postgres database — no signup required, works instantly:
   ```bash
   npx create-db -e .env
   ```
   This writes `DATABASE_URL` into `.env` and prints a `CLAIM_URL` to keep the database permanently later (otherwise it auto-expires).

   Alternatively, use any Postgres connection string you already have and put it in `.env` as `DATABASE_URL`.
3. Apply the schema:
   ```bash
   npx prisma migrate dev
   ```
4. Add a Vercel Blob token to `.env` for photo uploads (`BLOB_READ_WRITE_TOKEN`) — get one from the Vercel dashboard (**Storage → Create Store → Blob**), or leave it blank if you're not testing photos locally yet.
5. Run the app:
   ```bash
   npm run dev
   ```
6. Open [http://localhost:3000](http://localhost:3000) — since there are no users yet, you'll land on `/setup` to create the first admin account.

## Deploying to Vercel (free)

1. Push this repo to GitHub, then import it in [Vercel](https://vercel.com/new).
2. **Storage** tab → **Create Database → Postgres** (wires `DATABASE_URL` automatically).
3. **Storage** tab → **Create Store → Blob** (wires `BLOB_READ_WRITE_TOKEN` automatically).
4. Deploy. `npm install` runs `prisma generate` automatically (see `postinstall` in `package.json`).
5. Before the app can be used, the schema needs to exist in production: run `npx prisma migrate deploy` locally pointed at the production `DATABASE_URL` (copy it from Vercel's dashboard into a temporary `.env`).
6. Visit the deployed URL — you'll land on `/setup` to create the first admin account, same as local.

## Roles

| Role | Can do |
|---|---|
| `VIEWER` | View orders/products/families, Copy Excel |
| `EDITOR` | + create/accept/edit orders, record arrivals, manage remarks/photos, manage products & families |
| `ADMIN` | + manage users (create, change role, deactivate, delete) |

## Data model

- **Product family** → groups **Products** (name, MA SKU, KM SKU).
- **Order** → references a Product, tracks `qty`, `requestedDate` (auto-set), `neededByDate`, and once accepted, `containerNumber` + `estArrivalDate`.
- **Order arrivals** → an order can be fulfilled across multiple partial arrivals; status is derived from how much has arrived vs. `qty` (`REQUESTED` → `ACCEPTED` → `PARTIALLY_ARRIVED` → `ARRIVED`). The "final arrived date" shown is the arrival that completed fulfillment.
- **Remarks** → freeform notes per order; anyone with edit rights can add one, only the author (or an admin) can edit/delete it.
- **Photos** → uploaded per order via Vercel Blob; if an order has none, the UI shows its MA SKU / KM SKU instead.

"Copy Excel" copies a header row plus one row per order that is **not yet fully Arrived**, in this column order:

```
Container Number  Est. Arrival Date  Final Arrived Date  Product Name  MA SKU  KM SKU  QTY  Requested Date  Needed By Date  Acceptance Date
```
