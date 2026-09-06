// A01: Broken access control / IDOR.
//
// SmartBuy has no authentication (guest checkout only -- see CLAUDE.md and
// e2e/README.md). That's a documented, accepted tradeoff for order-by-id
// lookup: anyone holding an order id can view that one order, by design.
// It does NOT excuse an unauthenticated endpoint that returns every order
// in the system with no scoping at all -- that's a separate, unintended
// exposure this test checks for.
import test from 'node:test';
import assert from 'node:assert/strict';

const BASE = process.env.SECURITY_TARGET_URL ?? 'http://localhost:8822';

test('GET /api/orders does not return every customer\'s order with no scoping or auth', async () => {
  // Place two orders as two "different customers" first.
  await placeOrder({ fullName: 'Customer A', address: '1 A St', city: 'Alpha', zip: '11111' });
  await placeOrder({ fullName: 'Customer B', address: '2 B Ave', city: 'Beta', zip: '22222' });

  const res = await fetch(`${BASE}/api/orders`);
  assert.equal(res.status, 200);
  const orders = await res.json();

  assert.ok(
    orders.length <= 1,
    `GET /api/orders returned ${orders.length} orders with zero authentication -- this leaks every ` +
      `guest customer's full name, address, city, and zip to any unauthenticated caller (A01 + A02). ` +
      `Order-by-id is an accepted guest-checkout tradeoff; an unscoped list-all endpoint is not the same ` +
      `tradeoff and should require auth, be removed, or be scoped (e.g. admin-only, paginated + id-filtered).`
  );
});

test('resource-by-id endpoint rejects HTTP verb tampering', async () => {
  const del = await fetch(`${BASE}/api/orders/ORD-PROBE`, { method: 'DELETE' });
  assert.ok([404, 405].includes(del.status), `DELETE returned ${del.status}, expected 404/405`);

  const put = await fetch(`${BASE}/api/orders/ORD-PROBE`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ status: 'hacked' }),
  });
  assert.ok([404, 405].includes(put.status), `PUT returned ${put.status}, expected 404/405`);
});

async function placeOrder(shipping) {
  const res = await fetch(`${BASE}/api/orders`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ items: [{ productId: 1, qty: 1 }], shipping }),
  });
  if (res.status !== 201) throw new Error(`fixture order creation failed: ${res.status}`);
  return res.json();
}
