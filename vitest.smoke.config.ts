import { defineConfig } from 'vitest/config';
import path from 'path';
import fs from 'fs';

/**
 * Smoke test config — runs the happy-path flows against a REAL database.
 *
 * Unlike the main test suite (which mocks Prisma), these tests execute real
 * INSERT/SELECT against the database the app actually uses, so they catch
 * schema drift, migration gaps, and serialization bugs that mocked tests miss.
 *
 * Env is resolved the same way Next.js does: .env then .env.local overrides,
 * so the tests hit the same database as the running dev server.
 */
function loadAppEnv() {
  const root = __dirname;
  const files = ['.env', '.env.local'];
  const env: Record<string, string> = {};
  for (const file of files) {
    const filePath = path.join(root, file);
    if (!fs.existsSync(filePath)) continue;
    for (const rawLine of fs.readFileSync(filePath, 'utf8').split('\n')) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq === -1) continue;
      const key = line.slice(0, eq).trim();
      let value = line.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      env[key] = value; // later file (.env.local) overrides
    }
  }
  // Apply to process.env so the Prisma client picks it up.
  for (const [k, v] of Object.entries(env)) {
    process.env[k] = v;
  }
  return env;
}

loadAppEnv();

// PRODUCTION SAFETY: smoke tests write real rows. Never let them hit prod.
const PROD_HOST_MARKERS = ['hkndasbxwfreojgigffp'];
const resolvedDbUrl = process.env.DIRECT_URL || process.env.DATABASE_URL || '';
if (PROD_HOST_MARKERS.some((m) => resolvedDbUrl.includes(m))) {
  throw new Error(
    'Refusing to run smoke tests: resolved database is the PRODUCTION host. ' +
      'Smoke tests must run against the DEV database (.env.local). Aborting.'
  );
}

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/smoke/**/*.smoke.test.ts'],
    // Real DB writes — run serially and give generous timeouts for network.
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 60000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
      '@/lib': path.resolve(__dirname, './lib'),
      '@/components': path.resolve(__dirname, './components'),
      '@/app': path.resolve(__dirname, './app'),
    },
  },
});
