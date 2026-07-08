#!/usr/bin/env node
/**
 * Schema-drift guard.
 *
 * Verifies that every model/field declared in prisma/schema.prisma actually
 * exists as a table/column in the database the app connects to. Fails loudly
 * on any missing table or column.
 *
 * WHY THIS EXISTS
 * ---------------
 * The unit/property test suite mocks Prisma, so it cannot see the real database
 * schema. A Phase 2B migration was applied to the wrong database, leaving the
 * app's actual database (from .env.local) missing columns — which surfaced only
 * as a runtime 500. This guard closes that blind spot.
 *
 * CRITICAL ENV DETAIL
 * -------------------
 * This is a Next.js app: `.env.local` overrides `.env`. The Prisma CLI only reads
 * `.env` by default. This project points them at DIFFERENT databases, so the guard
 * resolves env the SAME way Next.js does and connects to the app's real database.
 *
 * We introspect via information_schema (rather than `prisma migrate diff`) because
 * Supabase databases contain cross-schema FKs into the `auth` schema that break
 * `migrate diff`.
 *
 * Exit codes:  0 = match,  1 = drift or error.
 * Usage: node scripts/check-schema-drift.js
 */

const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

// ── env resolution (mirror Next.js: .env then .env.local overrides) ──────────
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

function resolveAppEnv() {
  const root = process.cwd();
  return { ...parseEnvFile(path.join(root, '.env')), ...parseEnvFile(path.join(root, '.env.local')) };
}

function maskUrl(url) {
  return url.replace(/(:\/\/[^:]+:)[^@]+@/, '$1***@').replace(/@([^/]+)\/.*/, '@$1/...');
}

// ── schema parsing: model name -> Set(column names) ──────────────────────────
// Maps Prisma scalar field names to DB column names. Relation fields and
// block attributes (@@index etc.) are skipped since they are not columns.
function parseSchemaModels(schemaPath) {
  const text = fs.readFileSync(schemaPath, 'utf8');
  const models = {};
  const modelRegex = /model\s+(\w+)\s*\{([^}]*)\}/g;
  let m;
  while ((m = modelRegex.exec(text))) {
    const modelName = m[1];
    const body = m[2];
    const columns = new Set();
    for (const rawLine of body.split('\n')) {
      const line = rawLine.trim();
      if (!line || line.startsWith('//') || line.startsWith('@@')) continue;
      const fieldMatch = line.match(/^(\w+)\s+([A-Za-z0-9_\[\]?]+)(.*)$/);
      if (!fieldMatch) continue;
      const fieldName = fieldMatch[1];
      const fieldType = fieldMatch[2].replace(/[?\[\]]/g, '');
      const rest = fieldMatch[3];
      // Skip relation fields: type references another model, or has @relation.
      const isRelation = rest.includes('@relation') || /^[A-Z]/.test(fieldType) &&
        ![ 'String', 'Int', 'Boolean', 'DateTime', 'Json', 'Float', 'Decimal', 'BigInt', 'Bytes' ].includes(fieldType);
      if (isRelation) continue;
      // Honor @map("col") if present.
      const mapMatch = rest.match(/@map\("([^"]+)"\)/);
      columns.add(mapMatch ? mapMatch[1] : fieldName);
    }
    models[modelName] = columns;
  }
  return models;
}

async function main() {
  const appEnv = resolveAppEnv();
  const url = appEnv.DIRECT_URL || appEnv.DATABASE_URL;
  if (!url) {
    console.error('✗ Schema drift check could not run: no DATABASE_URL / DIRECT_URL in .env / .env.local');
    process.exit(1);
  }
  console.log('Checking database the app actually uses:', maskUrl(url));

  const expected = parseSchemaModels(path.join(process.cwd(), 'prisma', 'schema.prisma'));
  const prisma = new PrismaClient({ datasources: { db: { url } } });

  const problems = [];
  try {
    const rows = await prisma.$queryRaw`
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
    `;
    // Build table -> Set(columns)
    const actual = {};
    for (const r of rows) {
      (actual[r.table_name] ||= new Set()).add(r.column_name);
    }

    for (const [model, cols] of Object.entries(expected)) {
      const actualCols = actual[model];
      if (!actualCols) {
        problems.push(`Missing table: "${model}"`);
        continue;
      }
      for (const col of cols) {
        if (!actualCols.has(col)) {
          problems.push(`Missing column: "${model}.${col}"`);
        }
      }
    }
  } catch (e) {
    console.error('\n✗ Schema drift check could not run:\n');
    console.error(e.message);
    await prisma.$disconnect();
    process.exit(1);
  }
  await prisma.$disconnect();

  if (problems.length > 0) {
    console.error('\n✗ SCHEMA DRIFT DETECTED\n');
    console.error('The live database is missing tables/columns declared in prisma/schema.prisma:\n');
    for (const p of problems) console.error('  - ' + p);
    console.error(
      '\nThis project uses TWO databases (.env vs .env.local point to different DBs).\n' +
        'Make sure your migration ran against the .env.local database.\n' +
        'For the Phase 2B columns you can apply: prisma/phase_2b_columns.sql\n'
    );
    process.exit(1);
  }

  console.log('✓ Schema drift check passed — all schema tables/columns exist in the database');
  process.exit(0);
}

main();
