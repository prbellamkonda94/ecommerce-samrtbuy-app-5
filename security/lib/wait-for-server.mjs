// Stack-agnostic. Polls a health endpoint instead of a fixed sleep so an
// unusual startup delay (cold DB connection, migration) doesn't produce a
// flaky "server never started" failure.

/**
 * @param {string} url e.g. http://localhost:8822/api/health
 * @param {{ timeoutMs?: number, intervalMs?: number }} [opts]
 */
export async function waitForServer(url, opts = {}) {
  const timeoutMs = opts.timeoutMs ?? 20_000;
  const intervalMs = opts.intervalMs ?? 250;
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
      lastError = new Error(`Health check returned ${res.status}`);
    } catch (err) {
      lastError = err;
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(
    `Server at ${url} did not become healthy within ${timeoutMs}ms: ${lastError?.message}`
  );
}
