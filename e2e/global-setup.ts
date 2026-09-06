import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import pg from 'pg';
import { assertDistinctFromAppDatabase, parseDatabaseUrl } from './lib/db-safety.js';

const { Client } = pg;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

export default async function globalSetup(): Promise<void> {
  const envTestPath = path.join(__dirname, '.env.test');
  if (!fs.existsSync(envTestPath)) {
    throw new Error(
      'Missing e2e/.env.test. Copy e2e/.env.test.example to e2e/.env.test and set ' +
        'TEST_DATABASE_URL to a dedicated test database before running this suite. ' +
        "Never point it at the application's own database."
    );
  }
  const testEnv = dotenv.parse(fs.readFileSync(envTestPath));
  const testDbUrl = testEnv.TEST_DATABASE_URL;
  if (!testDbUrl) throw new Error('TEST_DATABASE_URL is not set in e2e/.env.test.');

  // The app's own .env, at the project root -- see server/index.js's
  // `import 'dotenv/config'`, which loads .env relative to cwd (the repo
  // root when the app runs normally).
  const appEnvPath = path.join(ROOT, '.env');
  if (!fs.existsSync(appEnvPath)) {
    throw new Error(`Expected to find ${appEnvPath} to compare against.`);
  }
  const appEnv = dotenv.parse(fs.readFileSync(appEnvPath));
  if (!appEnv.DATABASE_URL) throw new Error('.env has no DATABASE_URL to compare against.');

  // Hard safety gate -- see lib/db-safety.ts. This suite truncates
  // orders/order_items between runs, so it must be structurally incapable
  // of running against the app's real data, not just careful by convention.
  const testDb = parseDatabaseUrl(testDbUrl);
  const appDb = parseDatabaseUrl(appEnv.DATABASE_URL);
  assertDistinctFromAppDatabase(testDb, appDb);
  console.log(`[e2e] Test DB verified distinct from app DB: ${testDb.host}/${testDb.database}`);

  // Reuse the app's OWN seed script (server/seed.js) against the test
  // database via an env override, instead of duplicating the products/
  // orders/order_items schema DDL here. This is also what upserts the
  // product catalog that every spec's fixed product ids/prices/stock
  // depend on.
  const seed = spawnSync('node', ['server/seed.js'], {
    cwd: ROOT,
    env: { ...process.env, DATABASE_URL: testDbUrl },
    encoding: 'utf-8',
  });
  if (seed.stdout) console.log(seed.stdout.trim());
  if (seed.status !== 0) {
    console.error(seed.stderr);
    throw new Error('Seeding the test database failed (see output above).');
  }

  // Clear user-generated data so every run starts deterministic. products
  // is never truncated -- it's reference/catalog data, reseeded (upserted)
  // by server/seed.js above; tests key off its fixed ids/prices/stock.
  const client = new Client({ connectionString: testDbUrl, ssl: { rejectUnauthorized: true } });
  await client.connect();
  try {
    await client.query('TRUNCATE order_items, orders RESTART IDENTITY CASCADE');
  } finally {
    await client.end();
  }
  console.log('[e2e] Test database reset: orders/order_items cleared, catalog reseeded.');
}
