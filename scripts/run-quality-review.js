#!/usr/bin/env node
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const artifactsDir = path.join(root, '.cq_artifacts', String(Date.now()));
fs.mkdirSync(artifactsDir, { recursive: true });

function runCapture(cmd) {
  console.log('> ' + cmd);
  const res = spawnSync('bash', ['-lc', cmd], { cwd: root, env: process.env, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
  return { status: res.status, stdout: res.stdout || '', stderr: res.stderr || '' };
}

const results = {
  timestamp: new Date().toISOString(),
  playwright: null,
  tsc: null,
  eslint: null,
  security: null,
};

// 1) Run Playwright tests (if playwright is installed)
try {
  const pw = runCapture('npx playwright test --reporter=json --retries=1 --trace=on-first-retry');
  fs.writeFileSync(path.join(artifactsDir, 'playwright.json'), pw.stdout || '');
  fs.writeFileSync(path.join(artifactsDir, 'playwright.stderr.log'), pw.stderr || '');
  results.playwright = { status: pw.status, out: 'playwright.json', stderr: 'playwright.stderr.log' };
} catch (e) {
  console.error('Playwright run failed:', e);
}

// 2) TypeScript check
try {
  const tsc = runCapture('npx tsc --noEmit --pretty false');
  fs.writeFileSync(path.join(artifactsDir, 'tsc.stdout.log'), tsc.stdout || '');
  fs.writeFileSync(path.join(artifactsDir, 'tsc.stderr.log'), tsc.stderr || '');
  results.tsc = { status: tsc.status, stdout: 'tsc.stdout.log', stderr: 'tsc.stderr.log' };
} catch (e) {
  console.error('tsc check failed:', e);
}

// 3) ESLint (if available)
try {
  const eslint = runCapture('npx eslint --ext .ts,.tsx . -f json');
  // if eslint returns JSON in stdout, save it
  let eslintOut = eslint.stdout || '';
  // Some projects may print warnings to stderr; include both
  fs.writeFileSync(path.join(artifactsDir, 'eslint.json'), eslintOut);
  fs.writeFileSync(path.join(artifactsDir, 'eslint.stderr.log'), eslint.stderr || '');
  results.eslint = { status: eslint.status, out: 'eslint.json', stderr: 'eslint.stderr.log' };
} catch (e) {
  console.error('ESLint run failed:', e);
}

// 4) Security scan - attempt common script, do not fail if missing
try {
  const security = runCapture('npm run security-scan --silent || true');
  fs.writeFileSync(path.join(artifactsDir, 'security.stdout.log'), security.stdout || '');
  fs.writeFileSync(path.join(artifactsDir, 'security.stderr.log'), security.stderr || '');
  results.security = { status: security.status, stdout: 'security.stdout.log', stderr: 'security.stderr.log' };
} catch (e) {
  console.error('Security scan failed:', e);
}

// 5) Run lightweight typescript-react-reviewer (placeholder - generates suggestions file)
try {
  // The agent in workspace will consume artifacts; produce a changed-files manifest
  const changedFiles = runCapture('git diff --name-only --staged || true');
  fs.writeFileSync(path.join(artifactsDir, 'changed-files.txt'), changedFiles.stdout || '');
} catch (e) {}

// 6) Aggregate and write report
fs.writeFileSync(path.join(artifactsDir, 'report.json'), JSON.stringify(results, null, 2));

console.log('\nQuality review artifacts written to: ' + artifactsDir);
console.log('To have the agent process these artifacts, run in Copilot Chat:');
console.log(`@code-quality-reviewer run review with-artifacts:${artifactsDir}`);

process.exit(results.playwright && results.playwright.status === 0 && results.tsc && results.tsc.status === 0 ? 0 : 2);
