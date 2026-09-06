// A05: Security misconfiguration + CORS misconfiguration.
// server/index.js (checked in Phase 1) has no `cors` middleware at all --
// that means no Access-Control-Allow-Origin is ever set, which is the safe
// same-origin default. It also has no `helmet` or equivalent, so the
// standard security headers are expected to be absent -- these tests
// document that as findings rather than silently accepting it, since
// "the app happens to be same-origin only" and "the app sets no security
// headers" are two different things.
import test from 'node:test';
import assert from 'node:assert/strict';

const BASE = process.env.SECURITY_TARGET_URL ?? 'http://localhost:8822';

test('response does not fingerprint the framework via X-Powered-By', async () => {
  const res = await fetch(`${BASE}/api/health`);
  assert.equal(res.headers.get('x-powered-by'), null, 'Express default X-Powered-By header reveals the framework to attackers -- disable with app.disable("x-powered-by")');
});

test('response sets X-Content-Type-Options: nosniff', async () => {
  const res = await fetch(`${BASE}/api/health`);
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff', 'missing -- add helmet or set the header manually');
});

test('response sets a restrictive frame-ancestors / X-Frame-Options', async () => {
  const res = await fetch(`${BASE}/api/health`);
  const xfo = res.headers.get('x-frame-options');
  assert.ok(xfo, 'no X-Frame-Options set -- API/HTML responses are embeddable in a hostile iframe (clickjacking)');
});

test('CORS does not reflect an arbitrary origin together with credentials', async () => {
  const res = await fetch(`${BASE}/api/products`, {
    headers: { Origin: 'https://evil.example' },
  });
  const acao = res.headers.get('access-control-allow-origin');
  const acac = res.headers.get('access-control-allow-credentials');
  assert.ok(
    !(acao === 'https://evil.example' && acac === 'true'),
    'server reflects an arbitrary Origin while allowing credentials'
  );
  assert.ok(!(acao === '*' && acac === 'true'), 'ACAO: * with credentials: true is invalid and dangerous');
});

test('malformed JSON body does not leak a stack trace or file path', async () => {
  const res = await fetch(`${BASE}/api/orders`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{not valid json',
  });
  assert.ok(res.status >= 400 && res.status < 500, `expected a 4xx, got ${res.status}`);
  const body = await res.text();
  assert.ok(
    !/at\s+\S+\s+\(.*:\d+:\d+\)/.test(body) && !body.toLowerCase().includes('syntaxerror'),
    `error response leaked internals: ${body.slice(0, 200)}`
  );
});

test('.env contents are never served, even via the SPA catch-all fallback', async () => {
  // server/index.js's static handler falls through to a SPA catch-all
  // (`res.sendFile(index.html)` for any unmatched path) so any unknown
  // route -- including /.env -- legitimately returns 200 with the app
  // shell, which is correct behavior for client-side routing, not a
  // vulnerability. The actual thing to verify is that the RESPONSE BODY
  // is that same HTML shell, not the real .env file's contents.
  const res = await fetch(`${BASE}/.env`);
  const body = await res.text();
  assert.ok(!body.includes('DATABASE_URL='), 'response body contains real .env contents, not the SPA fallback page');
  assert.ok(body.includes('<div id="root">') || res.status === 404, 'expected either the SPA shell or a genuine 404, not something else');
});
