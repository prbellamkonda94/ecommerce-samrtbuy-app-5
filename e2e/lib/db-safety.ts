export interface ParsedDbUrl {
  user: string;
  password: string;
  host: string;
  port: number;
  database: string;
}

/**
 * Parses `postgres[ql]://user:pass@host[:port]/db[?query]` connection
 * strings. Neon (and most managed Postgres) connection strings omit the
 * port when it's the default 5432, so the port group is optional here.
 */
export function parseDatabaseUrl(url: string): ParsedDbUrl {
  const match = url.match(/^\w+(?:\+\w+)?:\/\/([^:]+):([^@]*)@([^:/]+)(?::(\d+))?\/([^?]+)/);
  if (!match) {
    throw new Error(
      `Could not parse database URL as postgres[ql]://user:pass@host[:port]/dbname: ${url}`
    );
  }
  const [, user, password, host, port, database] = match;
  return { user, password: decodeURIComponent(password), host, port: port ? Number(port) : 5432, database };
}

/**
 * This suite truncates orders/order_items on every run (see
 * global-setup.ts) so it must be structurally incapable of running against
 * the application's real database, not just careful by convention.
 * Compare host+database rather than the full URL so the same Neon endpoint
 * with a different database name (the recommended setup -- see
 * .env.test.example) is still accepted.
 */
export function assertDistinctFromAppDatabase(testDb: ParsedDbUrl, appDb: ParsedDbUrl): void {
  if (testDb.host === appDb.host && testDb.database === appDb.database) {
    throw new Error(
      `Refusing to run: TEST_DATABASE_URL points at the same host+database ` +
        `(${testDb.host}/${testDb.database}) as the application's own DATABASE_URL. ` +
        `This suite truncates orders/order_items between runs -- it must never run against real data. ` +
        `Point TEST_DATABASE_URL at a dedicated test database instead (see .env.test.example).`
    );
  }
}
