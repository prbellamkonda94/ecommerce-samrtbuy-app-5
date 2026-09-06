import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import { BACKEND_PORT, FRONTEND_PORT } from './lib/ports.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const envTestPath = path.join(__dirname, '.env.test');
// global-setup.ts is the actual gate (it also compares against the app's
// real .env and throws with a precise message) -- this repeats the check
// so a missing file fails at config-load time too, before any server is
// spawned.
const testEnv = fs.existsSync(envTestPath) ? dotenv.parse(fs.readFileSync(envTestPath)) : {};
const TEST_DATABASE_URL = testEnv.TEST_DATABASE_URL ?? '';

export default defineConfig({
  testDir: './tests',
  globalSetup: './global-setup.ts',
  globalTeardown: './global-teardown.ts',

  // Every test shares one backend + one database (see
  // reference/page-object-and-test-structure.md for why). Trade suite
  // speed for a regression suite that gives the same answer every time.
  workers: 1,
  fullyParallel: false,
  retries: 0,

  reporter: [['list'], ['html', { open: 'never' }]],

  use: {
    baseURL: `http://localhost:${FRONTEND_PORT}`,
    // Non-negotiable: this suite always runs with a visible browser, never
    // headless -- it's meant to be watched, not just trusted.
    headless: false,
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: [
    {
      command: `node server/index.js`,
      cwd: ROOT,
      url: `http://127.0.0.1:${BACKEND_PORT}/api/health`,
      timeout: 30_000,
      reuseExistingServer: !process.env.CI,
      env: {
        ...process.env,
        DATABASE_URL: TEST_DATABASE_URL,
        PORT: String(BACKEND_PORT),
      },
    },
    {
      command: `npx vite --config e2e/vite.config.test.ts --port ${FRONTEND_PORT} --strictPort`,
      cwd: ROOT,
      url: `http://localhost:${FRONTEND_PORT}/`,
      timeout: 30_000,
      reuseExistingServer: !process.env.CI,
    },
  ],
});
