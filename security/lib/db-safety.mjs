// Stack-agnostic: parses postgres://, postgresql://, and mysql:// alike via
// the built-in URL class. Copy as-is into a new app's security/lib/.

/**
 * @param {string} connectionString
 * @returns {{ host: string, database: string }}
 */
export function parseDbUrl(connectionString) {
  let u;
  try {
    u = new URL(connectionString);
  } catch {
    throw new Error(`Could not parse database URL: ${connectionString}`);
  }
  const database = u.pathname.replace(/^\//, '').split('?')[0];
  if (!u.hostname || !database) {
    throw new Error(`Database URL is missing a host or database name: ${connectionString}`);
  }
  return { host: u.hostname, database };
}

/**
 * Refuses to proceed if the test and app database URLs resolve to the same
 * host+database. This suite's dynamic tests create/enumerate data, send
 * injection payloads, and truncate user-generated tables between runs -- it
 * must be structurally incapable of running against the app's real database.
 *
 * @param {string} testUrl
 * @param {string} appUrl
 */
export function assertDistinctFromAppDatabase(testUrl, appUrl) {
  const testDb = parseDbUrl(testUrl);
  const appDb = parseDbUrl(appUrl);
  if (testDb.host === appDb.host && testDb.database === appDb.database) {
    throw new Error(
      `Refusing to run: the security suite's TEST_DATABASE_URL points at the same ` +
        `host+database (${testDb.host}/${testDb.database}) as the application's own ` +
        `DATABASE_URL. Dynamic tests intentionally probe injection and access control -- ` +
        `they must never run against real data. Point TEST_DATABASE_URL at a dedicated ` +
        `test database instead (see .env.test.example). If e2e/.env.test already defines ` +
        `an isolated test database for the UI suite, reuse that same value here.`
    );
  }
}
