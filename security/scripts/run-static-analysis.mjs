// Runs SAST (Semgrep), dependency/CVE audit (npm audit / pip-audit), and
// secret scanning (secretlint). No test database or running server needed --
// safe to run standalone via `npm run scan:static`.
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import config from '../security.config.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const securityRoot = join(__dirname, '..');
const artifactsDir = join(securityRoot, '.artifacts');
mkdirSync(artifactsDir, { recursive: true });

// shell:true is needed only to resolve npm/npx/pip .cmd shims on Windows;
// args are all fixed literals/config-driven paths (never attacker input),
// so the "unescaped args" risk shell:true normally carries doesn't apply
// here -- still avoided for plain executables (semgrep.exe, node) below.
function run(cmd, args, opts = {}) {
  // maxBuffer defaults to 1MB, which semgrep/secretlint JSON output on a
  // real repo can exceed silently (spawnSync truncates rather than
  // erroring, producing corrupt/unparseable JSON downstream) -- raise it.
  const result = spawnSync(cmd, args, { encoding: 'utf8', shell: true, maxBuffer: 100 * 1024 * 1024, ...opts });
  return {
    ok: result.status === 0,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    error: result.error,
  };
}

function commandExists(cmd) {
  const probe = process.platform === 'win32' ? run('where', [cmd]) : run('which', [cmd]);
  return probe.ok;
}

// `pip install <pkg>` without --user root perms often lands console scripts
// in a per-user Scripts/bin dir that isn't on PATH (a common Windows
// gotcha) -- resolve that dir directly via sysconfig rather than assuming
// PATH picks it up after install.
function resolveUserScriptPath(binName) {
  const scheme = process.platform === 'win32' ? 'nt_user' : 'posix_user';
  // No shell here deliberately: shell:true on Windows joins array args with
  // plain spaces (no quoting), which mangles a `-c` script containing
  // spaces/semicolons/quotes. python.exe is a real executable, resolvable
  // without a shell.
  const probeResult = spawnSync(
    'python',
    ['-c', `import sysconfig; print(sysconfig.get_path('scripts', '${scheme}'))`],
    { encoding: 'utf8' }
  );
  if (probeResult.status !== 0) return null;
  const scriptsDir = (probeResult.stdout ?? '').trim();
  const candidate = join(scriptsDir, process.platform === 'win32' ? `${binName}.exe` : binName);
  return existsSync(candidate) ? candidate : null;
}

const findings = { semgrep: null, dependencies: [], secrets: null, skipped: [] };

// --- Semgrep (SAST) ---------------------------------------------------
let semgrepCmd = null;
if (commandExists('semgrep')) {
  semgrepCmd = 'semgrep';
} else {
  console.log('semgrep not found on PATH -- attempting `pip install semgrep`...');
  const install = run('python', ['-m', 'pip', 'install', 'semgrep']);
  if (install.ok && commandExists('semgrep')) {
    semgrepCmd = 'semgrep';
  } else if (install.ok && resolveUserScriptPath('semgrep')) {
    semgrepCmd = resolveUserScriptPath('semgrep');
    console.log(`semgrep installed but not on PATH -- invoking directly at ${semgrepCmd}`);
  } else {
    findings.skipped.push(
      'SAST (semgrep): unavailable -- no semgrep on PATH and `python -m pip install semgrep` failed. ' +
        'Install Python/pip, or semgrep directly, and re-run `npm run scan:static`.'
    );
  }
}

if (semgrepCmd) {
  const configArgs = config.semgrep.configs.flatMap((c) => ['--config', c]);
  const excludeArgs = config.semgrep.excludeDirs.flatMap((d) => ['--exclude', d]);
  const outFile = join(artifactsDir, 'semgrep.json');
  console.log(`Running semgrep (${config.semgrep.configs.join(', ')})...`);
  const result = run(semgrepCmd, [
    'scan',
    ...configArgs,
    ...excludeArgs,
    '--json',
    '--output',
    outFile,
    config.appRoot,
  ]);
  if (!result.ok && !existsSync(outFile)) {
    findings.skipped.push(`SAST (semgrep): scan failed to produce output. stderr: ${result.stderr.slice(0, 500)}`);
  } else {
    findings.semgrep = outFile;
  }
}

// --- Dependency / CVE audit --------------------------------------------
for (const pkgPath of config.packageJsonPaths) {
  const dir = join(securityRoot, dirname(pkgPath));
  if (!existsSync(join(securityRoot, pkgPath))) continue;
  console.log(`Running npm audit in ${dir}...`);
  const result = run('npm', ['audit', '--json'], { cwd: dir });
  const outFile = join(artifactsDir, `npm-audit-${dirname(pkgPath).replace(/[\\/]/g, '_')}.json`);
  writeFileSync(outFile, result.stdout || '{}');
  findings.dependencies.push({ path: pkgPath, artifact: outFile });
}

if (config.pythonRequirementsPaths?.length && commandExists('pip-audit')) {
  for (const reqPath of config.pythonRequirementsPaths) {
    console.log(`Running pip-audit for ${reqPath}...`);
    const result = run('pip-audit', ['-r', join(securityRoot, reqPath), '-f', 'json']);
    const outFile = join(artifactsDir, `pip-audit-${reqPath.replace(/[\\/]/g, '_')}.json`);
    writeFileSync(outFile, result.stdout || '[]');
    findings.dependencies.push({ path: reqPath, artifact: outFile });
  }
} else if (config.pythonRequirementsPaths?.length) {
  findings.skipped.push('Dependency audit (pip-audit): unavailable -- install with `pip install pip-audit`.');
}

// --- Secret scanning -----------------------------------------------------
console.log('Running secretlint...');
const secretlintOut = join(artifactsDir, 'secretlint.json');
const secretlint = run(
  'npx',
  [
    '--yes',
    '-p',
    'secretlint',
    '-p',
    '@secretlint/secretlint-rule-preset-recommend',
    'secretlint',
    '--secretlintrc',
    join(__dirname, 'secretlint.config.json'),
    '--secretlintignore',
    join(__dirname, '.secretlintignore'),
    // Secretlint respects .gitignore by default (since v13) -- but a
    // gitignored .env or a stray "credentials.txt" (gitignored precisely
    // *because* it holds real secrets, per this app's own .gitignore) is
    // exactly the class of file this scan most needs to catch: the risk is
    // "plaintext secret exists on disk," not "exists in git." Disable the
    // gitignore cascade and rely solely on our own explicit
    // .secretlintignore for excluding node_modules/dist/build noise.
    '--no-gitignore',
    '--format',
    'json',
    '**/*',
  ],
  // Run with cwd = the app root (not security/) so both the glob and
  // .secretlintignore's patterns resolve against the app's real directory
  // structure.
  { cwd: join(securityRoot, config.appRoot) }
);
writeFileSync(secretlintOut, secretlint.stdout || '[]');
findings.secrets = secretlintOut;

writeFileSync(join(artifactsDir, 'static-summary.json'), JSON.stringify(findings, null, 2));
console.log('\nStatic analysis complete. Artifacts in security/.artifacts/.');
if (findings.skipped.length) {
  console.log('\nSkipped (see report for details):');
  for (const s of findings.skipped) console.log(`  - ${s}`);
}
