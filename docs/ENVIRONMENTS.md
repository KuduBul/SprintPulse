# Environments & Database Safety

This project uses **two separate Supabase databases**. Understanding which is
which is critical — the production instance is actively in use on Vercel.

## The two databases

| | Production | Development |
|---|---|---|
| Supabase project | `hkndasbxwfreojgigffp` | `jrcnttzdgipoalxxcnuh` |
| Region | eu-central-1 | eu-west-1 |
| Configured in | `.env` (git-ignored) | `.env.local` (git-ignored) |
| Used by | Vercel production deploys | Local `npm run dev` and all local tooling |
| Retro feature flag | off | `NEXT_PUBLIC_RETRO_ENABLED=true` |

## How env resolution works (and the trap)

- **Next.js** (the app / `npm run dev`) loads `.env` first, then **`.env.local`
  overrides it**. So the running app uses the **DEV** database. ✅
- **The Prisma CLI** (`npx prisma ...`) only reads **`.env`** by default. So a
  raw `npx prisma migrate dev` or `npx prisma db push` targets **PRODUCTION**. ⚠️
- **The Supabase MCP tool** is connected to the **PRODUCTION** project. Any write
  through it hits prod. ⚠️

This mismatch is what caused Phase 2B columns to be applied to prod while the dev
database (which the app actually uses) was left without them — surfacing as a 500.

## Safe commands — always use these

Never run `npx prisma migrate` / `db push` directly. Use the guarded wrappers,
which force the DEV database and hard-abort if they ever resolve to the prod host:

```bash
npm run db:migrate -- --name your_change   # prisma migrate dev, DEV only
npm run db:push                             # prisma db push, DEV only
npm run db:studio                           # prisma studio, DEV only
npm run db:generate                         # regenerate client (no DB write)
```

## Before handing off for testing

Run the full verification pipeline. It must be green before hand-off:

```bash
npm run verify
```

This runs, in order:
1. `check:schema` — fails if the DEV database is missing any table/column
   declared in `prisma/schema.prisma` (catches un-applied migrations / wrong DB).
2. `test` — the mocked unit + property suite (logic correctness).
3. `test:smoke` — real-database happy-path tests against the DEV database
   (catches schema drift, serialization, and migration gaps mocks cannot see).

## Applying a schema change to DEV

1. Edit `prisma/schema.prisma`.
2. `npm run db:migrate -- --name describe_change` (or apply SQL via the DEV
   `DIRECT_URL`, e.g. `prisma/phase_2b_columns.sql`).
3. `npm run db:generate`.
4. `npm run check:schema` to confirm DEV matches the schema.

## Applying a schema change to PRODUCTION

Production migrations are deliberately **not** automated here. When a feature is
ready to ship, apply the same, reviewed SQL to the production database as an
explicit, intentional step — never as a side effect of local development.

## Production-safety guarantees in place

- `.env` and `.env.local` are git-ignored; no DB credentials are committed.
- The Vercel deploy path uses dashboard env vars; the deploy script excludes
  `.env*` from the uploaded bundle.
- `scripts/prisma-dev.js` refuses to run if it resolves to the prod host.
- `vitest.smoke.config.ts` throws if smoke tests would run against the prod host.
