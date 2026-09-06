// Starts the backend against TEST_DATABASE_URL on an isolated port, seeds +
// truncates via the app's own mechanism, runs the DAST test files, then
// tears the server down in a finally -- regardless of test outcome.
import { config as loadEnv } from 'dotenv';
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import config from '../security.config.mjs';
import { assertDistinctFromAppDatabase } from '../lib/db-safety.mjs';
import { waitForServer } from '../lib/wait-for-server.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const securityRoot = join(__dirname, '..');
const appRoot = join(securityRoot, config.appRoot);
mkdirSync(join(securityRoot, '.artifacts'), { recursive: true });

// Explicitly security/.env.test -- NOT the default `.env` lookup, which
// would silently load nothing here (this dir has no .env) or, worse, could
// pick up a stray one; the test DB URL must come from exactly one place.
loadEnv({ path: join(securityRoot, '.env.test') });

const testDbUrl = process.env.TEST_DATABASE_URL;
if (!testDbUrl) {
  console.error('TEST_DATABASE_URL is not set. Copy .env.test.example to .env.test and fill it in.');
  process.exit(1);
}

// Read the app's own real DATABASE_URL from its .env, without importing the
// app's dotenv config (avoid mutating this process's env with it).
const appEnvPath = join(appRoot, '.env');
const { config: dotenvConfig } = await import('dotenv');
const appEnvParsed = dotenvConfig({ path: appEnvPath, processEnv: {} });
const appDbUrl = appEnvParsed.parsed?.DATABASE_URL;
if (appDbUrl) {
  assertDistinctFromAppDatabase(testDbUrl, appDbUrl);
} else {
  console.warn(`Could not read DATABASE_URL from ${appEnvPath} -- proceeding without the cross-check. ` +
    'Double-check TEST_DATABASE_URL is not the app\'s real database.');
}

console.log('Seeding test database via the app\'s own seed mechanism...');
const seed = spawnSync(config.seed.command, config.seed.args, {
  cwd: appRoot,
  env: { ...process.env, DATABASE_URL: testDbUrl },
  stdio: 'inherit',
  shell: true,
});
if (seed.status !== 0) {
  console.error('Seed step failed -- aborting dynamic tests.');
  process.exit(1);
}

if (config.truncateTables.length) {
  console.log(`Truncating user-generated tables: ${config.truncateTables.join(', ')}...`);
  await truncateTables(testDbUrl, config.truncateTables, config.dbDriver);
}

const port = config.backend.port;
process.env.SECURITY_TARGET_URL = `http://localhost:${port}`;

console.log(`Starting backend on port ${port} against the test database...`);
const backend = spawn(config.backend.command, config.backend.args, {
  cwd: appRoot,
  env: {
    ...process.env,
    ...config.backend.env,
    DATABASE_URL: testDbUrl,
    PORT: String(port),
  },
  stdio: 'inherit',
  shell: true,
});

let exitCode = 1;
try {
  await waitForServer(`http://localhost:${port}${config.backend.healthPath}`);
  console.log('Backend healthy. Running dynamic security tests...\n');
  const resultsPath = join(securityRoot, '.artifacts', 'dynamic-results.tap');
  const testRun = spawnSync(
    'node',
    [
      '--test',
      // Passing an explicit directory path here (even `./tests`) makes
      // this Node version try to `require()` it as a module instead of
      // discovering tests within it -- rely on --test's default discovery
      // of a `tests/` dir instead, with cwd set below.
      '--test-force-exit', // undici's fetch keep-alive sockets otherwise keep the process alive after tests finish
      '--test-reporter=spec',
      '--test-reporter-destination=stdout',
      // 'json' is NOT a valid built-in reporter name on at least Node
      // v24.19 (fails with ERR_MODULE_NOT_FOUND trying to import a package
      // literally named "json") -- 'tap' is stable and parseable;
      // generate-report.mjs parses this file directly.
      '--test-reporter=tap',
      `--test-reporter-destination=${resultsPath}`,
    ],
    { cwd: securityRoot, env: process.env, stdio: 'inherit' }
  );
  // Deliberately NOT propagating testRun.status here: a nonzero status
  // means "some security checks found something," not "this script
  // failed to run" -- and package.json chains this with `&&
  // generate-report.mjs`, so exiting nonzero for real findings would skip
  // report generation entirely (exactly the opposite of what should
  // happen). generate-report.mjs is the sole authority on the overall
  // gate exit code; this script's exit code reflects only whether the
  // run *itself* completed (seed/backend/spawn failures still exit 1
  // via the early-return and catch-block paths elsewhere in this file).
  exitCode = 0;
  if (testRun.status !== 0) {
    console.log('\nSome dynamic security checks failed -- see above, and security-report.md after report generation.');
  }
} catch (err) {
  console.error(`Dynamic test run failed to start: ${err.message}`);
} finally {
  console.log('\nTearing down backend...');
  backend.kill();
}

process.exit(exitCode);

async function truncateTables(dbUrl, tables, driver) {
  if (driver === 'pg') {
    const { default: pg } = await import('pg');
    const client = new pg.Client({ connectionString: dbUrl });
    await client.connect();
    try {
      await client.query(`TRUNCATE ${tables.map((t) => `"${t}"`).join(', ')} CASCADE`);
    } finally {
      await client.end();
    }
  } else if (driver === 'mysql2') {
    const { default: mysql } = await import('mysql2/promise');
    const conn = await mysql.createConnection(dbUrl);
    try {
      await conn.query('SET FOREIGN_KEY_CHECKS = 0');
      for (const t of tables) await conn.query(`TRUNCATE TABLE \`${t}\``);
      await conn.query('SET FOREIGN_KEY_CHECKS = 1');
    } finally {
      await conn.end();
    }
  } else {
    throw new Error(`Unsupported dbDriver "${driver}" in security.config.mjs (expected "pg" or "mysql2")`);
  }
}
