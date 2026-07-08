#!/usr/bin/env node
/**
 * Guarded Prisma CLI wrapper — ALWAYS targets the DEV database.
 *
 * WHY: `npx prisma <cmd>` reads `.env` by default, which in this project holds
 * PRODUCTION credentials (used by Vercel). Running a migration/db-push directly
 * would mutate the live production database. This wrapper loads `.env.local`
 * (the DEV database) and refuses to run if the resolved database looks like prod.
 *
 * Usage:
 *   node scripts/prisma-dev.js migrate dev --name add_something
 *   node scripts/prisma-dev.js db push
 *   node scripts/prisma-dev.js studio
 *
 * Or via npm:  npm run db:migrate -- --name add_something
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

// Host substrings that identify the PRODUCTION database. If a resolved
// connection string contains any of these, we refuse to run.
const PROD_HOST_MARKERS = ['hkndasbxwfreojgigffp'];

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const out = {};
  for (const rawLine of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function maskUrl(url) {
  return url.replace(/(:\/\/[^:]+:)[^@]+@/, '$1***@').replace(/@([^/]+)\/.*/, '@$1/...');
}

const root = process.cwd();
const localEnvPath = path.join(root, '.env.local');
if (!fs.existsSync(localEnvPath)) {
  console.error('✗ Refusing to run: .env.local (the DEV database config) was not found.');
  console.error('  Prisma would fall back to .env (PRODUCTION). Create .env.local first.');
  process.exit(1);
}

const devEnv = parseEnvFile(localEnvPath);
const databaseUrl = devEnv.DATABASE_URL;
const directUrl = devEnv.DIRECT_URL || databaseUrl;

if (!databaseUrl) {
  console.error('✗ Refusing to run: .env.local has no DATABASE_URL.');
  process.exit(1);
}

// Hard stop if the DEV config somehow points at production.
for (const marker of PROD_HOST_MARKERS) {
  if (databaseUrl.includes(marker) || directUrl.includes(marker)) {
    console.error('✗ SAFETY STOP: .env.local resolves to the PRODUCTION database host.');
    console.error('  Resolved:', maskUrl(directUrl));
    console.error('  Aborting to protect the live instance. Fix .env.local before retrying.');
    process.exit(1);
  }
}

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: node scripts/prisma-dev.js <prisma command> [...args]');
  console.error('Example: node scripts/prisma-dev.js migrate dev --name my_change');
  process.exit(1);
}

console.log('▶ Running Prisma against DEV database:', maskUrl(directUrl));

const result = spawnSync('npx', ['prisma', ...args], {
  stdio: 'inherit',
  env: {
    ...process.env,
    DATABASE_URL: databaseUrl,
    DIRECT_URL: directUrl,
  },
});

process.exit(result.status ?? 1);
