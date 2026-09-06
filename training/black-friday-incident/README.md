# Training Exercise: The Black Friday Incident

A self-contained subagent exercise. Nothing here touches the real app —
everything lives in this folder.

## The scenario

It's 06:10 on Black Friday morning (2026-07-25). Three hours before the sale
goes live, last night's load test finished and `report/incident-report.md`
landed in your inbox: a spike of `amount_mismatch` payment rejections between
05:40 and 06:07, spread across three services (`checkout-service`,
`payment-gateway`, `inventory-service`). Root cause: unknown. You have three
hours.

Start by reading **`report/incident-report.md`** — that's the artifact you'd
actually be handed in real life. Everything else in this folder
(`logs/`, `discount.js`) is the raw material behind it, which you are not
supposed to already know the contents of.

## Files

- `report/incident-report.md` — the symptom report (already generated, read this first)
- `logs/checkout-service.log`, `logs/payment-gateway.log`, `logs/inventory-service.log` — raw service logs behind the report
- `discount.js` — the checkout discount-calculation module (contains the bug — don't peek until step 2 below)
- `scripts/generate-logs.mjs`, `scripts/generate-report.mjs` — regenerate the above if you want a clean run (`node scripts/generate-logs.mjs && node scripts/generate-report.mjs`)

## Your job

Find the root cause and the fix. Do it using subagents, deliberately, at each
of the three points below — not because you couldn't do it yourself, but
because this is the exercise. See `SUBAGENT-GUIDE.md` for exactly what to
type at each step and why that step earns a subagent.

Constraint that matters pedagogically: **don't open `discount.js` yourself
before step 2.** The point is to watch a fresh agent find the bug in code you
haven't biased yourself on.
