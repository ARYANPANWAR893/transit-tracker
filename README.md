# Transit Tracker

Mobile-friendly tracker for container shipments moving through **Requested → Accepted → Arrived**, with a one-click "Copy Excel" button that copies every shipment that hasn't arrived yet as tab-separated data — paste it straight into a spreadsheet.

## Stack

- Next.js (App Router) + TypeScript + Tailwind
- Prisma + Postgres
- One shared password (no user accounts) — set via `APP_PASSWORD`

## Local development

1. Install dependencies:
   ```bash
   npm install
   ```
2. Get a free Postgres database. Easiest option — no signup required, works instantly:
   ```bash
   npx create-db -e .env
   ```
   This writes `DATABASE_URL` straight into `.env`. It also prints a `CLAIM_URL` — visit it later if you want to keep this database permanently (free Prisma account), otherwise it auto-expires.

   Alternatively, use any Postgres connection string you already have (Neon, Supabase, Vercel Postgres, etc.) and put it in `.env` as `DATABASE_URL`.
3. Add a password in `.env`:
   ```
   APP_PASSWORD="pick-something"
   ```
4. Apply the schema:
   ```bash
   npx prisma migrate dev
   ```
5. Run the app:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) and log in with `APP_PASSWORD`.

## Deploying to Vercel (free)

1. Push this repo to GitHub, then import it in [Vercel](https://vercel.com/new).
2. Add a Postgres database: in the project's **Storage** tab, click **Create Database → Postgres**. Vercel wires `DATABASE_URL` into your project's environment variables automatically.
3. Add one more environment variable: `APP_PASSWORD`.
4. Deploy. On every deploy, `npm install` runs `prisma generate` automatically (see `postinstall` in `package.json`).
5. The database schema needs to exist before the app can use it. Either:
   - Run `npx prisma migrate deploy` locally once, pointed at the production `DATABASE_URL` (copy it from Vercel's dashboard into a temporary `.env`), or
   - Use Vercel's "Deploy Hooks"/CLI to run it as part of your pipeline.

## How the workflow maps to data

| Stage | Fields captured |
|---|---|
| **Request** | Product name, SKU, ASIN, QTY, Requested date |
| **Accept** | + Container number, Est. arrival date, Acceptance date (stamped automatically) |
| **Arrived** | + Final arrived date (stamped automatically) |

"Copy Excel" copies a header row plus one row per shipment that is **not yet Arrived**, in this exact column order:

```
Container Number  Est. Arrival Date  Final Arrived Date  Product Name  SKU  ASIN  QTY  Requested Date  Acceptance Date
```
