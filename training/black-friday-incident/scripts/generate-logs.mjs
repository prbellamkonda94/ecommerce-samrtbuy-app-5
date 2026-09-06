// Generates synthetic multi-service logs for the Black Friday incident
// training scenario. Deterministic (no randomness) so the exercise is
// reproducible for every student.
//
// Run with: node training/black-friday-incident/scripts/generate-logs.mjs

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { calculateStackedTotal, calculatePreciseTotal } from "../discount.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOG_DIR = join(__dirname, "..", "logs");
mkdirSync(LOG_DIR, { recursive: true });

const DAY = "2026-07-25";
function t(h, m, s) {
  // normalize overflow (e.g. s=61 -> +1 minute, s=1)
  let totalSeconds = h * 3600 + m * 60 + s;
  h = Math.floor(totalSeconds / 3600);
  totalSeconds %= 3600;
  m = Math.floor(totalSeconds / 60);
  s = totalSeconds % 60;
  return `${DAY}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.000Z`;
}

// order plan: [id, hh, mm, ss, subtotal, discountPercents[], scenario]
// scenario: "ok" | "mismatch" | "card_declined"
const orders = [];
let n = 10400;

// --- baseline overnight traffic (00:00-05:39), mostly healthy ---
const baselineTimes = [
  [0, 5], [0, 42], [1, 10], [1, 47], [2, 3], [2, 28], [2, 55], [3, 12],
  [3, 40], [4, 1], [4, 22], [4, 38], [4, 51], [5, 6], [5, 14], [5, 22], [5, 31],
];
const baselineSubtotals = [
  59.99, 120.5, 34.0, 210.75, 88.2, 45.49, 15.99, 300.0,
  72.1, 19.99, 145.33, 61.75, 27.4, 99.0, 54.6, 183.25, 41.11,
];
baselineTimes.forEach(([h, m], i) => {
  const id = `ORD-${n++}`;
  const subtotal = baselineSubtotals[i];
  const discounts = i % 5 === 0 ? [10] : [];
  orders.push({ id, h, m, s: 10 + i * 3, subtotal, discounts, scenario: "ok" });
});
// one ordinary, unrelated payment failure during the quiet period (real-world noise)
orders.push({ id: `ORD-${n++}`, h: 3, m: 26, s: 44, subtotal: 64.5, discounts: [], scenario: "card_declined" });

// --- incident window (05:40-06:00): Black Friday promo traffic spikes,
//     stacked discounts (BF20 + LOYAL5) become common for the first time ---
// Subtotals for [20,5] entries below are pre-verified (via a brute-force
// search over discount.js) to actually trigger the per-step-rounding bug;
// arbitrary cent values only trigger it ~20% of the time.
const incidentOrders = [
  { m: 40, s: 12, subtotal: 50.07, discounts: [20, 5] },   // mismatch
  { m: 41, s: 5, subtotal: 58.0, discounts: [20] },        // ok (single discount)
  { m: 42, s: 13, subtotal: 58.11, discounts: [20, 5] },   // mismatch
  { m: 43, s: 40, subtotal: 74.85, discounts: [] },        // ok
  { m: 44, s: 51, subtotal: 66.12, discounts: [20, 5] },   // mismatch
  { m: 46, s: 2, subtotal: 39.99, discounts: [10] },       // ok
  { m: 47, s: 28, subtotal: 74.13, discounts: [20, 5] },   // mismatch
  { m: 48, s: 55, subtotal: 61.2, discounts: [] },         // ok
  { m: 50, s: 9, subtotal: 82.14, discounts: [20, 5] },    // mismatch
  { m: 51, s: 33, subtotal: 27.99, discounts: [20] },      // ok
  { m: 52, s: 47, subtotal: 90.18, discounts: [20, 5] },   // mismatch
  { m: 54, s: 6, subtotal: 300.0, discounts: [] },         // ok
  { m: 55, s: 21, subtotal: 98.32, discounts: [20, 5] },   // mismatch
  { m: 56, s: 40, subtotal: 45.0, discounts: [10] },       // ok
  { m: 57, s: 58, subtotal: 106.36, discounts: [20, 5] },  // mismatch
  { m: 59, s: 15, subtotal: 68.4, discounts: [20] },       // ok
];
incidentOrders.forEach(({ m, s, subtotal, discounts }) => {
  const id = `ORD-${n++}`;
  orders.push({ id, h: 5, m, s, subtotal, discounts, scenario: "auto" });
});

// --- tail (06:01-06:08): traffic tapering, same mix continues ---
const tailOrders = [
  { m: 1, s: 4, subtotal: 54.2, discounts: [] },
  { m: 2, s: 30, subtotal: 114.37, discounts: [20, 5] }, // mismatch
  { m: 4, s: 11, subtotal: 33.5, discounts: [10] },
  { m: 6, s: 45, subtotal: 122.39, discounts: [20, 5] }, // mismatch
  { m: 8, s: 2, subtotal: 90.0, discounts: [] },
];
tailOrders.forEach(({ m, s, subtotal, discounts }) => {
  const id = `ORD-${n++}`;
  orders.push({ id, h: 6, m, s, subtotal, discounts, scenario: "auto" });
});

// resolve "auto" scenario from the actual bug behavior
for (const o of orders) {
  if (o.scenario !== "auto") continue;
  const charged = calculateStackedTotal(o.subtotal, o.discounts);
  const expected = calculatePreciseTotal(o.subtotal, o.discounts);
  o.scenario = charged !== expected ? "mismatch" : "ok";
}

const checkoutLines = [];
const gatewayLines = [];
const inventoryLines = [];

function push(arr, h, m, s, line) {
  arr.push(`${t(h, m, s)} ${line}`);
}

for (const o of orders) {
  const { id, h, m, s, subtotal, discounts, scenario } = o;
  const charged = calculateStackedTotal(subtotal, discounts);
  const expected = calculatePreciseTotal(subtotal, discounts);

  push(checkoutLines, h, m, s, `[INFO] checkout-service order_id=${id} msg="order received" subtotal=${subtotal.toFixed(2)} discounts=[${discounts.join(",")}]`);
  push(inventoryLines, h, m, s + 1, `[INFO] inventory-service order_id=${id} msg="stock reserved"`);

  if (scenario === "card_declined") {
    push(checkoutLines, h, m, s + 2, `[INFO] checkout-service order_id=${id} msg="discount applied" total=${subtotal.toFixed(2)}`);
    push(gatewayLines, h, m, s + 3, `[ERROR] payment-gateway order_id=${id} msg="charge declined: insufficient_funds" amount=${subtotal.toFixed(2)}`);
    push(checkoutLines, h, m, s + 4, `[ERROR] checkout-service order_id=${id} msg="payment declined: insufficient_funds"`);
    continue;
  }

  push(checkoutLines, h, m, s + 2, `[INFO] checkout-service order_id=${id} msg="discount applied" total=${charged.toFixed(2)}`);

  if (scenario === "mismatch") {
    const diff = (charged - expected).toFixed(2);
    push(gatewayLines, h, m, s + 3, `[ERROR] payment-gateway order_id=${id} msg="charge rejected: amount_mismatch" expected=${expected.toFixed(2)} received=${charged.toFixed(2)} diff=${diff > 0 ? "+" + diff : diff}`);
    push(checkoutLines, h, m, s + 4, `[ERROR] checkout-service order_id=${id} msg="payment declined: amount_mismatch" total=${charged.toFixed(2)}`);
  } else {
    push(gatewayLines, h, m, s + 3, `[INFO] payment-gateway order_id=${id} msg="charge authorized" amount=${charged.toFixed(2)}`);
    push(checkoutLines, h, m, s + 4, `[INFO] checkout-service order_id=${id} msg="order confirmed" total=${charged.toFixed(2)}`);
  }
}

// inventory-service red herring: elevated "slow lookup" WARNs during the
// same load-test window, caused by Black Friday traffic volume, unrelated
// to the discount bug and NOT tied to the same order_ids that failed payment.
const slowLookupSkus = ["SKU-1042", "SKU-2231", "SKU-3390", "SKU-1188", "SKU-2077"];
const slowLookupTimes = [
  [5, 39, 50], [5, 41, 20], [5, 43, 5], [5, 45, 48], [5, 48, 30],
  [5, 50, 40], [5, 53, 15], [5, 55, 50], [5, 58, 5], [6, 0, 20], [6, 3, 40],
];
slowLookupTimes.forEach(([h, m, s], i) => {
  const sku = slowLookupSkus[i % slowLookupSkus.length];
  const latency = 700 + (i % 4) * 90;
  push(inventoryLines, h, m, s, `[WARN] inventory-service sku=${sku} msg="stock lookup slow" latency_ms=${latency}`);
});

function sortByTimestamp(lines) {
  return lines.sort((a, b) => a.localeCompare(b));
}

writeFileSync(join(LOG_DIR, "checkout-service.log"), sortByTimestamp(checkoutLines).join("\n") + "\n");
writeFileSync(join(LOG_DIR, "payment-gateway.log"), sortByTimestamp(gatewayLines).join("\n") + "\n");
writeFileSync(join(LOG_DIR, "inventory-service.log"), sortByTimestamp(inventoryLines).join("\n") + "\n");

console.log(`Generated logs for ${orders.length} orders in ${LOG_DIR}`);
console.log(`Mismatch orders: ${orders.filter((o) => o.scenario === "mismatch").map((o) => o.id).join(", ")}`);
