# Kudi

Kudi is a **Next.js** web app for on-chain earn on **Base**: portfolio, vault discovery, deposits and withdrawals, custodial wallet flows, and optional fiat on-ramp. Product data is merged from the app database and **LI.FI** earn positions; vault display values can be reconciled with on-chain ERC-4626 redeemable amounts where applicable.

## Stack

- **Next.js** (App Router), **React**, **TypeScript**
- **PostgreSQL** via **Prisma**
- **ethers** for Base / vault reads
- **LI.FI** Earn API + Composer quotes (see below)

## Getting started

From this directory:

```bash
npm install
cp .env.example .env
# Edit .env: DATABASE_URL, AUTH_SECRET, LIFI_API_KEY, and any optional keys.

npm run db:push   # or db:migrate — see Prisma workflow you use
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Scripts

| Command | Purpose |
|--------|---------|
| `npm run dev` | Development server (Turbopack) |
| `npm run build` | Production build |
| `npm run start` | Run production server |
| `npm run lint` | ESLint |
| `npm run db:generate` | `prisma generate` |
| `npm run db:push` | `prisma db push` |
| `npm run db:migrate` | `prisma migrate dev` |

Environment variables are documented in **`.env.example`** (database, auth secret, `LIFI_API_KEY`, optional Base RPC, gas sponsor, Paycrest).

## LI.FI usage

All LI.FI calls use the **`x-lifi-api-key`** header from **`LIFI_API_KEY`**.

| API | Base URL (in code) | Purpose |
|-----|-------------------|---------|
| Earn Data | `https://earn.li.fi` | `GET /v1/earn/vaults`, portfolio positions (`/v1/earn/portfolio/{address}/positions`) |
| Composer | `https://li.quest/v1/quote` | Quotes for deposit / withdraw route building |

Server helpers live under **`src/lib/lifi/`** (for example `server.ts`, `constants.ts`, portfolio merge and vault helpers). App routes include **`/api/lifi/vaults`**, **`/api/lifi/deposit`**, **`/api/lifi/withdraw`**, and portfolio aggregation in **`/api/wallet/portfolio`**.

## Project layout (high level)

- **`src/app/`** — routes, layouts, API route handlers
- **`src/components/`** — UI components
- **`src/lib/`** — auth, chain config, LI.FI, wallet, Paycrest, etc.
- **`prisma/`** — schema and migrations

## Deploy

Configure the same environment variables on your host (e.g. Vercel). Ensure `DATABASE_URL` uses a connection string appropriate for production (for example `sslmode=verify-full` as in `.env.example`).
