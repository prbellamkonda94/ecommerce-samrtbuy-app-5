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

## Performance tests

`k6/` is a standalone k6 load-test suite (own `package.json`, run from inside
`k6/`, not from the repo root):

```
cd k6
cp .env.k6.example .env.k6   # set TEST_DATABASE_URL (reuse e2e/security's if present)
CONCURRENT_USERS=<n> TPS_TARGET=<n> PEAK_LOAD=<n> LATENCY_P95_MS=<n> TAT_P95_MS=<n> npm run load
```

Same non-negotiable rule as `e2e/`/`security/`: `TEST_DATABASE_URL` must
never be the app's real `DATABASE_URL`. All five NFR target env vars are
required on every run (no defaults) — `scripts/run-load-test.mjs` seeds the
test DB, starts an isolated backend on port `8833`, runs a smoke test then
the full load profile (`tests/smoke.js`, `tests/load-test.js`,
`tests/browse-products.js`, `tests/order-lifecycle.js`), prints a pass/fail
scorecard against the given targets, then tears the backend down. This suite
is what originally surfaced the same-millisecond order-ID collision under
concurrent checkout (see Orders, above).

## Observability (optional, local-only)

OpenTelemetry instrumentation exists for the API server but is **off by
default** and has zero effect on the app, `npm run dev`, or the e2e/security
suites unless explicitly enabled — `server/otel/instrumentation.mjs` checks
`OTEL_ENABLED` before importing any OTel package, and every script (`dev`,
`dev:api`, `start`) loads it via `node --import`, which is safe to do
unconditionally because of that check.

To try it locally (Grafana + Prometheus + Tempo + Loki + an OTLP collector,
bundled in the official `grafana/otel-lgtm` image, entirely free and
self-contained):

```
docker compose -f docker-compose.otel.yml up -d   # one-time per session
```

Then set in `.env`:

```
OTEL_ENABLED=true
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
```

and run the app as usual (`npm run dev` / `npm start`). Open
http://localhost:3300 (Grafana, anonymous admin) and use Explore against the
Tempo, Loki, or Prometheus datasources — they're pre-wired for correlation
(a trace's "Logs for this span" jumps to Loki filtered by `trace_id`).

What's instrumented:
- **Traces**: HTTP requests (via `getNodeAutoInstrumentations`) and every
  Postgres call. The `sql` tagged-template in `server/db.js` wraps each call
  in its own span with real `db.statement`/`db.operation` attributes, because
  the Neon serverless driver talks over fetch/HTTP rather than a normal `pg`
  socket, so generic HTTP instrumentation alone can't tell a SELECT from an
  INSERT.
- **Logs**: `server/otel/logger.js` — structured JSON to stdout always (so
  `npm run dev` output is unchanged whether OTel is on or off), and to
  Loki when enabled, auto-stamped with the active span's `trace_id`/`span_id`.
- **Metrics**: generic HTTP request duration/count (auto-instrumentation),
  plus business counters in `server/otel/metrics.js` —
  `smartbuy.orders.placed`, `smartbuy.orders.value` (a histogram of order
  totals), and `smartbuy.checkout.errors` (labeled by rejection reason:
  `missing_items`, `missing_shipping`, `invalid_product_id`,
  `unknown_product`). This app has no real payment gateway, so
  `checkout.errors` is the closest meaningful proxy to "payment failed" —
  every case where a checkout attempt didn't turn into an order.

Known gotcha if you extend this: `@opentelemetry/sdk-logs`'s
`BatchLogRecordProcessor`/`SimpleLogRecordProcessor` constructors take an
options object (`new BatchLogRecordProcessor({ exporter })`), not the
exporter positionally — passing it positionally fails silently (no thrown
error, no diag output at default log levels; only visible with
`OTEL_LOG_LEVEL=debug`, and even then only as an absence of "items to be
sent" messages) and no log records reach the collector.

## Deployment

Deployed on Render as a single Web Service, defined by `render.yaml` (Blueprint): build command `npm install && npm run build`, start command `npm start`. This relies on the single-artifact serving behavior in `server/index.js` (API + static frontend from one Express process, one Node service — no separate static site). `DATABASE_URL` is set directly on the Render service (not in `render.yaml`, which only marks it `sync: false`); production reuses the same Neon database as local dev. Pushing to `main` auto-deploys.

## Training exercise (unrelated to the app)

`training/black-friday-incident/` is a self-contained subagent-delegation
exercise (log triage, fresh-eyes code review, ship-readiness audit) with its
own fabricated logs and a deliberately buggy `discount.js`. It does not
touch, import from, or get imported by the real app — see its own
`README.md`/`SUBAGENT-GUIDE.md` if asked to work in that folder.
