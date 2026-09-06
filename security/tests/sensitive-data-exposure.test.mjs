// A02: Sensitive data exposure.
// SmartBuy's checkout form (src/pages/Checkout.jsx) collects a card number
// for validation but never includes it in the POST /api/orders body -- only
// fullName/address/city/zip are sent. Confirmed by reading the component;
// the test below is the runtime confirmation that the API never echoes back
// or otherwise handles a card number even if one were sent.
import test from 'node:test';
import assert from 'node:assert/strict';

const BASE = process.env.SECURITY_TARGET_URL ?? 'http://localhost:8822';

test('a card number sent to the API (even though the real UI never does) is not persisted or echoed back', async () => {
  const res = await fetch(`${BASE}/api/orders`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      items: [{ productId: 1, qty: 1 }],
      shipping: { fullName: 'PII Probe', address: '1 Test St', city: 'Testville', zip: '00000' },
      cardNumber: '4242424242424242',
    }),
  });
  assert.equal(res.status, 201);
  const order = await res.json();
  assert.ok(
    !JSON.stringify(order).includes('4242424242424242'),
    'a card number field was echoed back in the order response -- it should be ignored entirely, never persisted or returned'
  );

  const reread = await fetch(`${BASE}/api/orders/${order.id}`);
  const rereadBody = await reread.text();
  assert.ok(!rereadBody.includes('4242424242424242'), 'card number appeared on re-read of the order');
});

test('unhandled server error does not leak raw SQL or internal file paths', async () => {
  const res = await fetch(`${BASE}/api/orders`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ items: new Array(5000).fill({ productId: 1, qty: 1 }) }),
  });
  const body = await res.text();
  assert.ok(!/SELECT|INSERT|UPDATE\s/i.test(body), `response leaked raw SQL: ${body.slice(0, 200)}`);
  assert.ok(!body.includes('node_modules'), `response leaked a filesystem path: ${body.slice(0, 200)}`);
});

test('GET /api/orders/:id does not leak internal-only fields (e.g. raw DB row shape beyond the documented response contract)', async () => {
  const create = await fetch(`${BASE}/api/orders`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      items: [{ productId: 1, qty: 1 }],
      shipping: { fullName: 'Contract Probe', address: '1 Test St', city: 'Testville', zip: '00000' },
    }),
  });
  const order = await create.json();
  const allowedTopLevelKeys = ['id', 'subtotal', 'shippingCost', 'total', 'status', 'placedAt', 'shipping', 'items'];
  const extraKeys = Object.keys(order).filter((k) => !allowedTopLevelKeys.includes(k));
  assert.deepEqual(extraKeys, [], `response includes undocumented fields: ${extraKeys.join(', ')}`);
});
