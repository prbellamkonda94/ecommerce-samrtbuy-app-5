# SmartBuy E2E suite (Playwright)

A real, repeatable UI regression suite -- not a demo. Run it on demand
before merging anything that touches the cart, checkout, or the order
API (`server/routes/orders.js`).

## One-time setup

```bash
cd e2e
npm install
npx playwright install chromium
cp .env.test.example .env.test   # then fill in TEST_DATABASE_URL
```

`TEST_DATABASE_URL` must point at a database dedicated to this suite --
**never** the app's own root `.env` database. This project's test database
is `neondb_test`, a sibling database on the same Neon endpoint as the real
`neondb` (same host, different database name -- the recommended setup).
`global-setup.ts` verifies this automatically and refuses to run if the
two resolve to the same host+database, because every run truncates
`orders`/`order_items`.

## Running

```bash
cd e2e
npm test
```

This always opens a real, visible Chromium window (`headless: false` is
fixed in `playwright.config.ts`, not a flag) -- watch it if you want to see
what broke. `npm run report` opens the last HTML report (screenshots,
traces, and video are captured for anything that fails).

## What happens on every run

1. **global-setup.ts** verifies `TEST_DATABASE_URL` is distinct from the
   app's real `DATABASE_URL` (from the project root `.env`), then runs the
   app's own `server/seed.js` against it (schema + product catalog --
   single source of truth, not duplicated here), then truncates
   `order_items`/`orders` so every run starts from the same deterministic
   state. `products` is never truncated; tests key off its fixed
   ids/prices/stock from `shared/catalog.js` (see `fixtures/catalog.ts`).
2. Playwright's `webServer` config starts a backend (`node server/index.js`,
   port 8811) and frontend (`vite --config e2e/vite.config.test.ts`, port
   4310) pointed at the test database -- separate ports from the normal dev
   servers (3001/5173) so this can run alongside your own `npm run dev`
   without colliding.
3. Tests run serially (`workers: 1`) against one shared backend/database,
   trading suite speed for a regression suite that gives the same answer
   every time. This app has no auth (guest checkout only) and `/api/orders`
   isn't scoped to a user, so tests assert on their own order by id rather
   than assuming an empty order history.

## What's covered

- `product-browsing.spec.ts` -- home page categories/top-rated, category
  tile navigation, header search, sidebar category filter, sort by price,
  the empty-results state, product detail (including its own qty-input
  stock clamp), an unknown product id, and the 404 route.
- `cart.spec.ts` -- adding from the grid and from the detail page, the
  free-shipping threshold ($50) on both sides, updating/removing/clearing
  line items, and the cart surviving a full page reload (it's persisted to
  `localStorage`, not the server).
- `checkout-and-orders.spec.ts` -- checkout's empty-cart redirect,
  required-field and format validation (ZIP, card number), the full happy
  path (browse -> cart -> checkout -> confirmation -> order history), and
  an unknown order id.
- `stock-clamping.spec.ts` -- **the invariant CLAUDE.md calls out by
  name**: `POST /api/orders` re-prices and clamps quantity to available
  stock server-side. The product detail page's own qty input clamps
  client-side, but the cart page's qty input does not (`src/pages/Cart.jsx`
  only enforces a minimum of 1), so a requested quantity past stock can
  reach the server -- this is the test most worth running before any change
  to `server/routes/orders.js`.

## Page objects

`pages/*.page.ts` models each route the same way the app is routed
(`src/App.jsx`); `pages/nav.page.ts` models the header (`Header.jsx`) that's
present on every page. Add new locators there, not inline in a spec file,
so a markup change only needs updating in one place.

## Bugs this suite found (and fixed) while being built

Two real, pre-existing bugs in `src/pages/Checkout.jsx` surfaced on the
first real run of `checkout-and-orders.spec.ts` and `stock-clamping.spec.ts`
-- both are now fixed in the app itself, not worked around in the tests:

1. **Every successful checkout silently landed back on an empty cart page
   instead of the order confirmation.** `handleSubmit` called `clearCart()`
   then `navigate(...)`. React Router doesn't swap the rendered route in
   the same pass as the `navigate()` call, so `Checkout` re-rendered once
   more with the now-empty cart before actually unmounting, tripping its
   own `if (cartDetails.length === 0) return <Navigate to="/cart" />`
   guard and clobbering the intended navigation. The order was created
   successfully server-side the whole time -- the user just never saw it.
   Fixed with an `orderPlacedRef` that suppresses the guard once an order
   has been placed, independent of render timing.
2. **A cold/direct load of `/checkout` with a non-empty cart bounced to
   `/cart`.** The guard checked `cartDetails` (only populated once
   `ProductsContext`'s async product fetch resolves), so on a fresh page
   load it was briefly `[]` while products were still loading. Fixed by
   guarding on the raw persisted `items` array instead, which is available
   synchronously from `localStorage`.

## Adapting this to a different app

This suite's structure (global-setup DB isolation + safety gate, Page
Object Model, fixed non-dev ports, `workers: 1` for a shared-DB suite) is
meant to be the reusable part. What's app-specific and needs rewriting:
`pages/*.page.ts` (routes and locators), `fixtures/catalog.ts` (this app's
fixed product ids/prices/stock), and the `webServer` commands in
`playwright.config.ts` if the target app isn't Vite + Express + Postgres.
