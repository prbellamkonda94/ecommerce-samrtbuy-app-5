// A03: Injection. SmartBuy's queries all use @neondatabase/serverless's
// tagged-template `sql` helper (server/db.js), which parameterizes every
// interpolated value -- confirmed by reading server/routes/products.js and
// server/routes/orders.js (no raw string concatenation into any query).
// These tests are the runtime confirmation pass for that.
import test from 'node:test';
import assert from 'node:assert/strict';

const BASE = process.env.SECURITY_TARGET_URL ?? 'http://localhost:8822';

const PAYLOADS = [
  "' OR '1'='1",
  "' OR '1'='1' --",
  "'; DROP TABLE orders; --",
  '1 OR 1=1',
  "1' UNION SELECT NULL,NULL,NULL--",
];

function looksLikeStackTrace(body) {
  return /at\s+\S+\s+\(.*:\d+:\d+\)/.test(body) || /Traceback/.test(body) || body.includes('node_modules');
}

for (const payload of PAYLOADS) {
  test(`GET /api/products/:id rejects injection payload cleanly: ${payload}`, async () => {
    const res = await fetch(`${BASE}/api/products/${encodeURIComponent(payload)}`);
    // products.js explicitly validates Number.isInteger(id) before querying,
    // so every non-numeric payload should be a 400, never reach the DB.
    assert.equal(res.status, 400, `expected 400 for non-numeric id, got ${res.status}`);
    const body = await res.text();
    assert.ok(!looksLikeStackTrace(body), `leaked what looks like a stack trace: ${body.slice(0, 200)}`);
  });

  test(`GET /api/orders/:id rejects injection payload cleanly: ${payload}`, async () => {
    const res = await fetch(`${BASE}/api/orders/${encodeURIComponent(payload)}`);
    // orders.js interpolates req.params.id directly into a parameterized
    // query with no format pre-check -- a malicious id should still just
    // miss (404), never 500, since the driver parameterizes it either way.
    assert.ok([400, 404].includes(res.status), `expected 400/404, got ${res.status}`);
    const body = await res.text();
    assert.ok(!looksLikeStackTrace(body), `leaked what looks like a stack trace: ${body.slice(0, 200)}`);
  });
}

test('free-text shipping fields with SQLi-shaped content are stored as literal strings, not executed', async () => {
  const res = await fetch(`${BASE}/api/orders`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      items: [{ productId: 1, qty: 1 }],
      shipping: {
        fullName: "Robert'); DROP TABLE orders;--",
        address: "1 Main St' OR '1'='1",
        city: 'Testville',
        zip: '00000',
      },
    }),
  });
  assert.equal(res.status, 201, `expected the order to be created normally (parameterized insert), got ${res.status}`);
  const order = await res.json();
  assert.equal(order.shipping.fullName, "Robert'); DROP TABLE orders;--", 'the literal string should round-trip unchanged, not be interpreted as SQL');

  // Confirm the "DROP TABLE" payload didn't actually do anything.
  const stillWorks = await fetch(`${BASE}/api/orders/${order.id}`);
  assert.equal(stillWorks.status, 200, 'orders table should be intact after the payload above');
});
