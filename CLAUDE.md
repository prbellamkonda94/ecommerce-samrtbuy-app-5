# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

SmartBuy — a React + Express e-commerce demo app (product catalog, cart, checkout, orders) backed by Neon serverless Postgres.

## Commands

- `npm run dev` — runs both the Vite dev server and the API server concurrently (`web` on Vite's default port, `api` on `:3001`, proxied via `vite.config.js`). This is the normal way to develop.
- `npm run dev:api` — API server only, with `node --watch` for auto-restart.
- `npm run build` — production build of the frontend (`vite build`, outputs to `dist/`).
- `npm start` — runs `server/index.js` directly; if `dist/` exists it is served as static files from the same Express process (single-artifact deploy), otherwise only the API routes work.
- `npm run db:seed` — creates tables if missing and upserts the product catalog from `shared/catalog.js` into Postgres. Run this after changing `shared/catalog.js` or against a fresh database.
- `npm run lint` — Oxlint (see `.oxlintrc.json`). There is no test suite in this repo.
- `npm run preview` — preview a production build via Vite.

There is no dedicated single-test command since there is no test runner configured for the frontend/API. A separate Playwright E2E suite exists in `e2e/` (own `package.json`, not a workspace) — see below.

## Environment

Requires `DATABASE_URL` (Neon Postgres connection string) and optional `PORT` (default `3001`) in a `.env` file — copy `.env.example` to start. `server/db.js` throws at import time if `DATABASE_URL` is unset.

## Architecture

**Three-tier layout:**
- `src/` — React 19 frontend (Vite, React Router). Talks to the API only through `src/api/client.js`, never `fetch` directly.
- `server/` — Express 5 API (`server/index.js` wires routes, JSON body parsing, a 404 fallback for unmatched `/api` paths, and a generic error handler). Route handlers live in `server/routes/*.js`.
- `shared/catalog.js` — the canonical product catalog (`PRODUCTS`, `CATEGORIES`), imported by both `server/seed.js` (to populate Postgres) and the frontend (`CATEGORIES` only, for filter UI — actual product data always comes from the API, not from this file, at runtime).

**Data flow:** Postgres is the source of truth for products/orders at runtime. `NUMERIC` columns come back from `@neondatabase/serverless` as strings, so route handlers explicitly cast them to `Number` at the API boundary (see `formatProduct`/`formatOrder` in `server/routes/*.js`) — preserve this pattern when adding fields.

**Frontend state:** two React Context providers wrap the app in `src/main.jsx`:
- `ProductsContext` fetches the full product list once on mount and exposes `getProductById`.
- `CartContext` persists cart items (`{ productId, qty }`) to `localStorage` via the generic `useLocalStorage` hook, and derives `cartDetails`/`subtotal`/`itemCount` by joining against `ProductsContext`. Cart items only store `productId` + `qty`, never denormalized product data.

**Orders:** `POST /api/orders` (`server/routes/orders.js`) re-validates and re-prices items server-side from the DB (never trusts client-submitted prices), clamps quantity to available stock, computes shipping (free over $50, else $5.99), and generates order IDs as `ORD-<base36 timestamp>-<random suffix>` (the random suffix was added after a k6 load test surfaced same-millisecond primary-key collisions under concurrent checkout). Orders and order items are separate tables (`orders`, `order_items`), joined and reshaped into a nested `items[]` array in API responses.

**Routing:** all pages render inside a shared `Layout` (`src/components/Layout.jsx`) via a wrapping `Route` in `src/App.jsx`.

## E2E tests

`e2e/` is a standalone Playwright suite (its own `package.json`, run from inside `e2e/`, not from the repo root):

```
cd e2e
npm install && npx playwright install chromium   # one-time
cp .env.test.example .env.test                   # then set TEST_DATABASE_URL
npm test                                          # run the suite
npm run report                                    # open the last HTML report
```

`TEST_DATABASE_URL` must be a database dedicated to this suite (e.g. a sibling `neondb_test` database on the same Neon endpoint), never the app's real `DATABASE_URL` — `global-setup.ts` refuses to run otherwise because every run truncates `orders`/`order_items`. The suite always runs with a real, visible Chromium window (`headless: false` is fixed in `playwright.config.ts`) and serially (`workers: 1`) against dedicated ports (backend `8811`, frontend `4310`) so it can run alongside `npm run dev` without colliding. See `e2e/README.md` for what each spec file covers and the reusable-vs-app-specific parts of the suite.

## Security tests

`security/` is a standalone SAST + DAST suite (own `package.json`, run
from inside `security/`, not from the repo root):

```
cd security
npm install
cp .env.test.example .env.test   # or reuse e2e/.env.test's TEST_DATABASE_URL
npm run scan                     # static (Semgrep, npm audit, secretlint) + dynamic (OWASP Top 10 checks) + report
```

Same non-negotiable rule as `e2e/`: `TEST_DATABASE_URL` must never be the
app's real `DATABASE_URL` — `lib/db-safety.mjs` refuses to run otherwise.
Run this before merging anything that touches auth, data access, or
externally-facing endpoints. See `security/README.md` for current findings
(as of the last run: an unauthenticated `GET /api/orders` leaks every
guest's PII — unused by the frontend, recommended to remove or gate — plus
missing security headers) and which are accepted design tradeoffs (no
auth; guest checkout only) versus real bugs.

## Deployment

Deployed on Render as a single Web Service, defined by `render.yaml` (Blueprint): build command `npm install && npm run build`, start command `npm start`. This relies on the single-artifact serving behavior in `server/index.js` (API + static frontend from one Express process, one Node service — no separate static site). `DATABASE_URL` is set directly on the Render service (not in `render.yaml`, which only marks it `sync: false`); production reuses the same Neon database as local dev. Pushing to `main` auto-deploys.
