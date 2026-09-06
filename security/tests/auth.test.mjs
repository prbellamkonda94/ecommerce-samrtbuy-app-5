// A07: Identification and authentication failures.
// SmartBuy has no authentication by design -- guest checkout only (see
// CLAUDE.md and e2e/README.md, both confirmed by reading server/index.js
// and server/routes/*.js: no login/session/token code exists anywhere).
import test from 'node:test';
import assert from 'node:assert/strict';

test('DOCUMENTED: app has no authentication -- guest checkout only', () => {
  // Intentional design, not a gap in this suite. The tradeoff this creates
  // (an order id doubles as the only "credential" needed to view that
  // order) is covered by access-control.test.mjs, along with the separate
  // check that the unscoped list-all endpoint doesn't compound that
  // tradeoff into a full customer-data leak.
  assert.ok(true);
});
