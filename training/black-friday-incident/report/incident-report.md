# Incident Report: Checkout Error Spike -- Black Friday Load Test

**Generated from:** `logs/checkout-service.log`, `logs/payment-gateway.log`, `logs/inventory-service.log`
**Report generated:** 2026-07-25T08:41:41.748Z

## 1. Summary

- Orders processed in log window: **39**
- `amount_mismatch` charge rejections (payment-gateway): **10**
- Unrelated `insufficient_funds` declines (normal background rate): **1**
- `checkout-service` errors surfaced to customers: **11**
- `inventory-service` WARN entries (slow stock lookups): **11**
- First `amount_mismatch` observed: **2026-07-25T05:40:15.000Z**
- Last `amount_mismatch` observed: **2026-07-25T06:06:48.000Z**

All `amount_mismatch` rejections fall inside a single ~25-minute window, overlapping the Black Friday promo load test. Before this window, error rate was background-normal (one unrelated card decline in ~5.5 hours).

## 2. Errors by Service

| Service | Error type | Count |
|---|---|---|
| payment-gateway | amount_mismatch | 10 |
| payment-gateway | insufficient_funds (unrelated) | 1 |
| checkout-service | payment declined (all causes) | 11 |
| inventory-service | stock lookup slow (WARN) | 11 |

## 3. Affected Orders (amount_mismatch)

| Order ID | Timestamp | Expected | Received | Diff |
|---|---|---|---|---|
| ORD-10418 | 2026-07-25T05:40:15.000Z | 38.05 | 38.06 | +0.01 |
| ORD-10420 | 2026-07-25T05:42:16.000Z | 44.16 | 44.17 | +0.01 |
| ORD-10422 | 2026-07-25T05:44:54.000Z | 50.25 | 50.26 | +0.01 |
| ORD-10424 | 2026-07-25T05:47:31.000Z | 56.34 | 56.33 | -0.01 |
| ORD-10426 | 2026-07-25T05:50:12.000Z | 62.43 | 62.42 | -0.01 |
| ORD-10428 | 2026-07-25T05:52:50.000Z | 68.54 | 68.53 | -0.01 |
| ORD-10430 | 2026-07-25T05:55:24.000Z | 74.72 | 74.73 | +0.01 |
| ORD-10432 | 2026-07-25T05:58:01.000Z | 80.83 | 80.84 | +0.01 |
| ORD-10435 | 2026-07-25T06:02:33.000Z | 86.92 | 86.93 | +0.01 |
| ORD-10437 | 2026-07-25T06:06:48.000Z | 93.02 | 93.01 | -0.01 |

## 4. Other Signals Observed

`inventory-service` shows an elevated rate of "stock lookup slow" WARN entries during the same load-test window. Whether this is related to the checkout errors above, or a separate side effect of Black Friday traffic volume, has **not yet been determined**.

## 5. Root Cause

**Not yet determined.** Assigned for investigation.
