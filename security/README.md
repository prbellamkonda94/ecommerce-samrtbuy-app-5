# SmartBuy security suite (SAST + DAST)

A real, repeatable security regression suite -- not a one-off scan. Run it
on demand before merging anything that touches auth, data access, or
externally-facing endpoints.

## One-time setup

```bash
cd security
npm install
cp .env.test.example .env.test   # or reuse e2e/.env.test's TEST_DATABASE_URL -- same isolated neondb_test database
```

`TEST_DATABASE_URL` must point at a database dedicated to security testing
-- **never** the app's own root `.env` database. This project reuses the
same `neondb_test` database as the `e2e/` UI suite (a sibling database on
the same Neon endpoint as the real `neondb`). `lib/db-safety.mjs` verifies
this automatically and refuses to run if `TEST_DATABASE_URL` resolves to
the same host+database as the app's own `DATABASE_URL`.

## Running

```bash
npm run scan            # static + dynamic + report
npm run scan:static     # SAST, dependency audit, secrets only -- no DB/server needed
npm run scan:dynamic    # DAST only -- needs TEST_DATABASE_URL
```

Exit code is non-zero if any HIGH/CRITICAL finding is present -- wire this
into CI or a pre-merge check the same way you would a failing test suite.
The full report is written to `security-report.md` (human-readable) and
`security-report.json` (machine-readable).

## What each phase does

1. **Static analysis** (`scripts/run-static-analysis.mjs`) -- Semgrep
   against `p/owasp-top-ten` + `p/security-audit` + JS/React/Node packs,
   `npm audit` across the app's root and `e2e/` manifests, and
   `secretlint` over the working tree (with `.gitignore` deliberately
   **disabled** for this scan -- a gitignored `.env` is exactly the class
   of file most worth catching, since the risk is "plaintext secret on
   disk," not "committed to git"). No test database or running server
   needed.
2. **Dynamic analysis** (`scripts/run-dynamic-tests.mjs`) -- seeds the test
   database via `server/seed.js`, truncates `orders`/`order_items`, starts
   `server/index.js` on port 8822 (distinct from the app's dev port 3001
   and `e2e/`'s port 8811) pointed at `TEST_DATABASE_URL`, waits for
   `/api/health`, then runs every `tests/*.test.mjs` file before tearing
   the backend down.
3. **Report** (`scripts/generate-report.mjs`) -- merges both phases'
   artifacts (`.artifacts/`) into one Markdown/JSON report grouped by OWASP
   category, with severity and a gate verdict.

## What's covered

- `tests/injection.test.mjs` -- A03. Confirms `server/routes/products.js`
  and `server/routes/orders.js` (both use `@neondatabase/serverless`'s
  parameterized tagged-template `sql` helper, never string concatenation)
  reject classic SQLi payloads cleanly on `:id` params, and that free-text
  shipping fields containing SQLi-shaped strings round-trip as literal text
  rather than being interpreted.
- `tests/access-control.test.mjs` -- A01. Checks `GET /api/orders`
  (list-all) scoping and HTTP verb tampering on `/api/orders/:id`.
- `tests/headers-and-cors.test.mjs` -- A05 + CORS. Security headers,
  CORS behavior (the app has no `cors` middleware at all, which is the
  secure same-origin default -- confirmed absent rather than misconfigured),
  malformed-body error handling, and the SPA catch-all's handling of
  sensitive-looking paths like `/.env`.
- `tests/sensitive-data-exposure.test.mjs` -- A02. Confirms the checkout
  form's card number (`src/pages/Checkout.jsx`) is never sent to or
  persisted by the API, and that order responses match their documented
  field contract.
- `tests/auth.test.mjs` -- A07. Documents SmartBuy's no-auth,
  guest-checkout-only design rather than skipping the category.

Dependency audit and Semgrep results are in `security-report.md` alongside
the dynamic findings above.

## Current findings (last run)

**A01 -- `GET /api/orders` leaks every guest's PII, unauthenticated.**
The endpoint returns every order in the system (full name, address, city,
zip) with no auth and no filtering. Order-by-id lookup with no auth is
this app's accepted guest-checkout tradeoff (see below) -- an *unscoped
list-all* endpoint is a separate, unintended exposure: nothing in the
frontend calls it (`src/` has no reference to `GET /api/orders` without an
id), so it's dead product surface that only adds risk. Recommended fix:
remove the route, or gate it behind an admin-only mechanism if it's needed
for operational use later.

**A05 -- missing security headers + framework fingerprinting.**
`server/index.js` has no `helmet` (or equivalent) and doesn't disable
Express's default `X-Powered-By` header. Missing: `X-Content-Type-Options:
nosniff`, `X-Frame-Options`/`frame-ancestors`. Recommended fix: add
`app.disable('x-powered-by')` and either `helmet` or the equivalent headers
set manually in `server/index.js`.

**A02 -- real DB credentials in plaintext, on disk but not in git.**
`.env`, `Database connection details.txt`, `e2e/.env.test`, and
`security/.env.test` all contain the real/test Neon connection string.
All four are listed in `.gitignore` and confirmed never committed
(secretlint's finding is downgraded to MEDIUM specifically because of
this) -- but they're still plaintext secrets on disk. No action required
beyond normal laptop/workstation hygiene, unless this repo is ever shared
(zipped, screen-shared, etc.) without excluding these files.

**Dependency audit**: 0 vulnerabilities (`npm audit`) as of the last run,
across both the root app and `e2e/`.

**Semgrep (SAST) could not run** on this machine: the pip-installed
`semgrep.exe` is blocked by this Windows machine's Device Guard/WDAC
policy (an organizational security control, not a bug in this suite).
Options: run this suite's static phase in CI instead (a different,
unrestricted machine), ask IT to allowlist `semgrep.exe`, or install
Docker Desktop and start its daemon so `run-static-analysis.mjs` can fall
back to the `returntocorp/semgrep` image (not yet wired up as an automatic
fallback -- see `reference/static-analysis-tools.md` in the skill this
suite was scaffolded from).

## Known accepted risk

- **No authentication; guest checkout only.** `POST /api/orders` requires
  no login, and `GET /api/orders/:id` requires only knowing the order id
  (`ORD-<base36 timestamp>` -- not cryptographically random, but not
  sequential/guessable either). This is this app's intentional design as a
  demo storefront, documented in the project's own `CLAUDE.md`. The
  unscoped list-all endpoint above is explicitly **not** covered by this
  acceptance -- it's a separate issue.

## Adapting this to a different app

This suite's structure (DB isolation + safety gate reused from `e2e/`,
isolated non-dev backend port, static-then-dynamic phases, OWASP-category
report) is meant to be the reusable part; see the `e2e-code-security-review`
skill this was scaffolded from for a stack-agnostic version of everything
here.
