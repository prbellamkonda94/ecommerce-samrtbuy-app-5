// Parses the synthetic incident logs and produces the symptom-level report
// an on-call engineer would see at 6am -- errors observed, no root cause yet.
// That investigation is the point of the subagent exercise (see README.md).
//
// Run with: node training/black-friday-incident/scripts/generate-report.mjs

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOG_DIR = join(__dirname, "..", "logs");
const REPORT_DIR = join(__dirname, "..", "report");
mkdirSync(REPORT_DIR, { recursive: true });

function readLines(file) {
  return readFileSync(join(LOG_DIR, file), "utf8").trim().split("\n");
}

const checkout = readLines("checkout-service.log");
const gateway = readLines("payment-gateway.log");
const inventory = readLines("inventory-service.log");

const ERROR_RE = /^(\S+) \[ERROR\] (\S+) order_id=(\S+) msg="([^"]+)"(.*)$/;
const WARN_RE = /^(\S+) \[WARN\] (\S+)(.*)$/;

function parseErrors(lines) {
  const errors = [];
  for (const line of lines) {
    const m = line.match(ERROR_RE);
    if (m) {
      const [, ts, service, orderId, msg, rest] = m;
      errors.push({ ts, service, orderId, msg, rest: rest.trim() });
    }
  }
  return errors;
}

const checkoutErrors = parseErrors(checkout);
const gatewayErrors = parseErrors(gateway);
const inventoryWarns = inventory.filter((l) => WARN_RE.test(l));

const mismatchErrors = gatewayErrors.filter((e) => e.msg.includes("amount_mismatch"));
const declinedErrors = gatewayErrors.filter((e) => e.msg.includes("insufficient_funds"));

const totalOrders = new Set(checkout.map((l) => l.match(/order_id=(\S+)/)?.[1]).filter(Boolean)).size;

function fmtRow(e) {
  const rest = {};
  for (const [, k, v] of e.rest.matchAll(/(\w+)=([^\s]+)/g)) rest[k] = v;
  return `| ${e.orderId} | ${e.ts} | ${rest.expected ?? "-"} | ${rest.received ?? "-"} | ${rest.diff ?? "-"} |`;
}

const first = mismatchErrors[0]?.ts ?? "n/a";
const last = mismatchErrors[mismatchErrors.length - 1]?.ts ?? "n/a";

const report = `# Incident Report: Checkout Error Spike -- Black Friday Load Test

**Generated from:** \`logs/checkout-service.log\`, \`logs/payment-gateway.log\`, \`logs/inventory-service.log\`
**Report generated:** ${new Date().toISOString()}

## 1. Summary

- Orders processed in log window: **${totalOrders}**
- \`amount_mismatch\` charge rejections (payment-gateway): **${mismatchErrors.length}**
- Unrelated \`insufficient_funds\` declines (normal background rate): **${declinedErrors.length}**
- \`checkout-service\` errors surfaced to customers: **${checkoutErrors.length}**
- \`inventory-service\` WARN entries (slow stock lookups): **${inventoryWarns.length}**
- First \`amount_mismatch\` observed: **${first}**
- Last \`amount_mismatch\` observed: **${last}**

All \`amount_mismatch\` rejections fall inside a single ~25-minute window, overlapping the Black Friday promo load test. Before this window, error rate was background-normal (one unrelated card decline in ~5.5 hours).

## 2. Errors by Service

| Service | Error type | Count |
|---|---|---|
| payment-gateway | amount_mismatch | ${mismatchErrors.length} |
| payment-gateway | insufficient_funds (unrelated) | ${declinedErrors.length} |
| checkout-service | payment declined (all causes) | ${checkoutErrors.length} |
| inventory-service | stock lookup slow (WARN) | ${inventoryWarns.length} |

## 3. Affected Orders (amount_mismatch)

| Order ID | Timestamp | Expected | Received | Diff |
|---|---|---|---|---|
${mismatchErrors.map(fmtRow).join("\n")}

## 4. Other Signals Observed

\`inventory-service\` shows an elevated rate of "stock lookup slow" WARN entries during the same load-test window. Whether this is related to the checkout errors above, or a separate side effect of Black Friday traffic volume, has **not yet been determined**.

## 5. Root Cause

**Not yet determined.** Assigned for investigation.
`;

writeFileSync(join(REPORT_DIR, "incident-report.md"), report);
console.log(`Wrote report to ${join(REPORT_DIR, "incident-report.md")}`);
