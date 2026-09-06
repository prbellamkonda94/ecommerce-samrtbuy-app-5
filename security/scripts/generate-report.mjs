// Merges static + dynamic artifacts into security/security-report.md (+.json),
// grouped by OWASP category. Exits non-zero if any HIGH/CRITICAL finding
// exists, so this doubles as the pre-merge/CI gate.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import config from '../security.config.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const securityRoot = join(__dirname, '..');
const artifactsDir = join(securityRoot, '.artifacts');
const appRoot = join(securityRoot, config.appRoot);

function isGitIgnored(filePath) {
  const result = spawnSync('git', ['check-ignore', '-q', filePath], { cwd: appRoot });
  return result.status === 0;
}

const args = process.argv.slice(2);
const staticOnly = args.includes('--static-only');
const dynamicOnly = args.includes('--dynamic-only');

const findings = [];
const skipped = [];

function readJson(path, fallback) {
  if (!existsSync(path)) return fallback;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return fallback;
  }
}

const SEMGREP_SEVERITY = { ERROR: 'HIGH', WARNING: 'MEDIUM', INFO: 'LOW' };

if (!dynamicOnly) {
  // --- Semgrep ---
  const semgrep = readJson(join(artifactsDir, 'semgrep.json'), null);
  if (semgrep?.results) {
    for (const r of semgrep.results) {
      findings.push({
        category: categorizeSemgrepRule(r.check_id),
        severity: SEMGREP_SEVERITY[r.extra?.severity] ?? 'MEDIUM',
        tool: 'semgrep',
        title: r.check_id,
        location: `${r.path}:${r.start?.line}`,
        detail: r.extra?.message ?? '',
      });
    }
  }

  // --- npm audit / pip-audit ---
  const staticSummary = readJson(join(artifactsDir, 'static-summary.json'), { dependencies: [], skipped: [] });
  for (const dep of staticSummary.dependencies ?? []) {
    const data = readJson(dep.artifact, null);
    if (!data) continue;
    if (data.vulnerabilities) {
      // npm audit v2 JSON shape
      for (const [name, vuln] of Object.entries(data.vulnerabilities)) {
        findings.push({
          category: 'A06',
          severity: (vuln.severity ?? 'moderate').toUpperCase(),
          tool: 'npm audit',
          title: `${name}: ${vuln.via?.[0]?.title ?? 'known vulnerability'}`,
          location: dep.path,
          detail: `Range: ${vuln.range}. Fix available: ${vuln.fixAvailable ? 'yes' : 'no'}.`,
        });
      }
    } else if (Array.isArray(data)) {
      // pip-audit JSON shape
      for (const item of data) {
        for (const vuln of item.vulns ?? []) {
          findings.push({
            category: 'A06',
            severity: 'HIGH',
            tool: 'pip-audit',
            title: `${item.name} ${item.version}: ${vuln.id}`,
            location: dep.path,
            detail: vuln.fix_versions?.length
              ? `Fix available: ${vuln.fix_versions.join(', ')}`
              : 'No fix available yet.',
          });
        }
      }
    }
  }
  skipped.push(...(staticSummary.skipped ?? []));

  // --- secretlint ---
  const secrets = readJson(join(artifactsDir, 'secretlint.json'), []);
  const secretResults = Array.isArray(secrets) ? secrets : secrets?.results ?? [];
  for (const file of secretResults) {
    if (!file.messages?.length) continue;
    // Defensive filter, independent of secretlint's own ignore-pattern
    // matching (observed to be unreliable for this on at least one
    // Windows run): this suite's own prior artifacts (secretlint.json
    // embeds full sourceContent of every scanned file, including any real
    // secrets found) must never be re-scanned as if they were newly
    // discovered secrets -- that's a self-referential noise loop, not a
    // finding.
    if (/[\\/]\.artifacts[\\/]/.test(file.filePath)) continue;
    const gitignored = isGitIgnored(file.filePath);
    for (const m of file.messages ?? []) {
      findings.push({
        category: 'A02',
        // secretlint reports 'error'/'warning'; a secret in a file that's
        // gitignored (never committed) is still worth fixing (don't leave
        // real credentials in plaintext on disk at all) but is a materially
        // different risk than one that's actually in version control, so
        // it's downgraded rather than reported at the same severity.
        severity: gitignored ? 'MEDIUM' : m.severity === 'error' ? 'CRITICAL' : 'HIGH',
        tool: 'secretlint',
        title: m.ruleId ?? 'possible secret',
        location: `${file.filePath}:${m.loc?.line ?? '?'}`,
        detail: `${m.message}${gitignored ? ' (file is gitignored -- not committed to version control, but still plaintext on disk)' : ' -- NOT gitignored, check whether this was ever committed (git log -p -- <file>)'}`,
      });
    }
  }
}

if (!staticOnly) {
  // --- dynamic (node:test TAP reporter) ---
  const tapPath = join(artifactsDir, 'dynamic-results.tap');
  if (existsSync(tapPath)) {
    const tap = readFileSync(tapPath, 'utf8');
    for (const t of parseTapFailures(tap)) {
      findings.push({
        category: categorizeDastTest(t.location),
        severity: 'HIGH',
        tool: 'dynamic',
        title: t.name,
        location: t.location || 'security/tests/',
        detail: t.error || '(see security/.artifacts/dynamic-results.tap for full diagnostics)',
      });
    }
  } else {
    skipped.push('Dynamic results: no dynamic-results.tap found -- did `run-dynamic-tests.mjs` run?');
  }
}

function categorizeSemgrepRule(ruleId) {
  const id = ruleId.toLowerCase();
  if (id.includes('sql') || id.includes('injection') || id.includes('command-injection')) return 'A03';
  if (id.includes('secret') || id.includes('hardcoded') || id.includes('crypto')) return 'A02';
  if (id.includes('cors')) return 'CORS';
  if (id.includes('auth')) return 'A07';
  if (id.includes('access-control') || id.includes('idor')) return 'A01';
  if (id.includes('ssrf')) return 'A10';
  return 'A05';
}

function categorizeDastTest(location) {
  const file = (location || '').toLowerCase();
  if (file.includes('injection')) return 'A03';
  if (file.includes('access-control')) return 'A01';
  if (file.includes('headers-and-cors')) return 'A05';
  if (file.includes('sensitive-data-exposure')) return 'A02';
  if (file.includes('auth')) return 'A07';
  return 'DAST';
}

// Node's TAP reporter (--test-reporter=tap) is the format actually stable
// on this Node version -- the 'json' built-in reporter name fails outright
// (see run-dynamic-tests.mjs). TAP's diagnostic YAML block per failing test
// isn't full YAML, but it's regular enough to line-scan without a real
// parser: a `not ok N - <name>` line, followed by an indented block that
// may contain `location: '<path>:<line>:<col>'` and an `error:` field in
// one of three shapes (inline double-quoted, inline single-quoted, or a
// `|-` block scalar continuing until the next 2-space-indented `key:` line
// or the closing `...`).
function parseTapFailures(tap) {
  const lines = tap.split(/\r?\n/);
  const failures = [];
  let i = 0;
  while (i < lines.length) {
    const header = lines[i].match(/^(not ok|ok) \d+ - (.*)$/);
    if (!header) {
      i++;
      continue;
    }
    const isFailure = header[1] === 'not ok';
    const name = header[2];
    i++;
    let location = '';
    const errorParts = [];
    let inBlockScalar = false;
    while (i < lines.length && !/^(not ok|ok) \d+ - /.test(lines[i]) && !/^1\.\.\d+$/.test(lines[i])) {
      const line = lines[i];
      const locMatch = line.match(/^\s*location: '(.*)'$/);
      if (locMatch) location = locMatch[1];

      if (inBlockScalar) {
        if (/^\s{2}\S+:/.test(line) || line.trim() === '...') {
          inBlockScalar = false;
        } else if (line.trim()) {
          errorParts.push(line.trim());
        }
      } else if (/^\s*error: \|-\s*$/.test(line)) {
        inBlockScalar = true;
      } else {
        const dq = line.match(/^\s*error: "(.*)"\s*$/);
        const sq = line.match(/^\s*error: '(.*)'\s*$/);
        if (dq) errorParts.push(dq[1]);
        else if (sq) errorParts.push(sq[1]);
      }
      i++;
    }
    if (isFailure) {
      failures.push({ name, location, error: errorParts.join(' ').trim() });
    }
  }
  return failures;
}

const severityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, MODERATE: 2, LOW: 3, INFO: 4 };
findings.sort((a, b) => (severityOrder[a.severity] ?? 5) - (severityOrder[b.severity] ?? 5));

const byCategory = {};
for (const f of findings) {
  (byCategory[f.category] ??= []).push(f);
}

const gateFailed = findings.some((f) => ['CRITICAL', 'HIGH'].includes(f.severity));

let md = `# Security scan report\n\n`;
md += `Generated: ${new Date().toISOString()}\n\n`;
md += `**Overall: ${gateFailed ? 'FAIL' : 'PASS'}** (${findings.length} finding(s), ${
  findings.filter((f) => ['CRITICAL', 'HIGH'].includes(f.severity)).length
} at HIGH/CRITICAL)\n\n`;

if (skipped.length) {
  md += `## Skipped checks\n\n`;
  for (const s of skipped) md += `- ${s}\n`;
  md += '\n';
}

for (const [category, items] of Object.entries(byCategory)) {
  md += `## ${category} (${items.length})\n\n`;
  for (const f of items) {
    md += `- **[${f.severity}]** ${f.title} — \`${f.location}\` (${f.tool})\n  ${f.detail}\n`;
  }
  md += '\n';
}

if (findings.length === 0) {
  md += `No findings recorded. Confirm this reflects real coverage, not a skipped phase — see "Skipped checks" above.\n`;
}

writeFileSync(join(securityRoot, 'security-report.md'), md);
writeFileSync(
  join(securityRoot, 'security-report.json'),
  JSON.stringify({ generatedAt: new Date().toISOString(), gateFailed, findings, skipped }, null, 2)
);

console.log(`\nReport written to security/security-report.md (${findings.length} finding(s)).`);
console.log(gateFailed ? 'GATE: FAIL (HIGH/CRITICAL finding present)' : 'GATE: PASS');
process.exit(gateFailed ? 1 : 0);
