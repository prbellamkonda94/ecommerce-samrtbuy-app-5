export default {
  appRoot: '..',

  // Distinct from the app's own dev port (3001) and from e2e/'s backend
  // port (8811), so all three can run in the same CI job without colliding.
  backend: {
    command: 'node',
    args: ['server/index.js'],
    port: 8822,
    healthPath: '/api/health',
    env: {},
  },

  seed: {
    command: 'npm',
    args: ['run', 'db:seed'],
  },

  // products/categories are reference data populated by db:seed -- never
  // truncated. orders/order_items are user-generated -- truncated before
  // every run so dynamic tests start from a deterministic state.
  truncateTables: ['order_items', 'orders'],

  dbDriver: 'pg',

  packageJsonPaths: ['../package.json', '../e2e/package.json'],
  pythonRequirementsPaths: [],

  semgrep: {
    configs: ['p/owasp-top-ten', 'p/security-audit', 'p/secrets', 'p/javascript', 'p/react', 'p/nodejs'],
    excludeDirs: ['node_modules', 'dist', '.git', 'e2e', 'security'],
  },
};
