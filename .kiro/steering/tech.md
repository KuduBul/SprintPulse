# Tech Stack & Build

## Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router, typed routes) |
| Language | TypeScript (strict mode) |
| UI | React 18 |
| Database | PostgreSQL (Supabase-hosted) |
| ORM | Prisma 5 |
| Auth | Supabase Auth via `@supabase/ssr` |
| Validation | Zod |
| Styling | CSS custom properties (design tokens) — no Tailwind, no CSS-in-JS |
| Testing | Vitest + React Testing Library + fast-check (property-based) |
| Hosting | Vercel |
| Package Manager | npm |

## Key Libraries

- `@dnd-kit/core` + `@dnd-kit/sortable` — drag-and-drop canvas
- `@react-pdf/renderer` — PDF export (server-external to avoid React conflicts)
- `sharp` — image processing
- `qrcode` — QR code generation
- `react-markdown` + `remark-gfm` + `rehype-*` — markdown rendering
- `uuid` — ID generation
- `fast-check` — property-based testing

## Commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start Next.js dev server |
| `npm run build` | Prisma generate + Next.js production build |
| `npm run lint` | ESLint |
| `npm run test` | Run unit + property tests (vitest, single run) |
| `npm run test:watch` | Vitest in watch mode |
| `npm run test:coverage` | Tests with v8 coverage report |
| `npm run test:smoke` | Smoke tests against real DB (separate config) |
| `npm run verify` | Schema drift check + tests + smoke tests |
| `npm run db:migrate` | Run Prisma migrations (dev) |
| `npm run db:push` | Push schema to DB without migration |
| `npm run db:generate` | Regenerate Prisma client |
| `npm run db:studio` | Open Prisma Studio |

## Configuration

- Path aliases: `@/` (root), `@/lib/*`, `@/components/*`, `@/app/*`
- TypeScript strict mode enabled
- Vitest: jsdom environment, 20s timeout, globals enabled
- Separate `vitest.smoke.config.ts` for smoke tests hitting a real database
- `next.config.js`: typed routes, `@react-pdf/*` as serverExternalPackages

## Environment Variables

- `DATABASE_URL` — Supabase Postgres connection (required)
- `DIRECT_URL` — Direct Postgres URL for migrations
- `NEXT_PUBLIC_RETRO_ENABLED` — Feature flag: set to `"true"` to enable retro boards
- `RETENTION_RESPONSES_DAYS` — Response purge window (default 90)
- `RETENTION_AUDIT_DAYS` — Audit log retention (default 365)
- `POLL_INTERVAL_MS` — Live result polling interval (default 3000)
