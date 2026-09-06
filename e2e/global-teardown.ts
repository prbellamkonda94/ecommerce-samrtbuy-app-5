export default async function globalTeardown(): Promise<void> {
  // Test data is deliberately left in TEST_DATABASE_URL after the run (not
  // the app's database -- see global-setup.ts) so a failure can be
  // inspected afterwards; the next run's global-setup truncates it again.
  console.log('[e2e] Run complete.');
}
