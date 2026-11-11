# Project Structure

## Directory Layout

```
app/                        # Next.js App Router
├── layout.tsx              # Root layout (Inter font, globals.css, skip-link)
├── page.tsx                # Landing page (facilitator/participant entry)
├── admin/                  # Authenticated facilitator dashboard
│   ├── polls/              # Poll CRUD and facilitator mode
│   ├── teams/              # Team management
│   └── profile/            # User profile
├── api/                    # Route handlers (REST-style)
│   ├── polls/              # Poll CRUD, responses, results, tokens
│   ├── retro/              # Retro board API (boards, cards, votes, export)
│   ├── teams/              # Team CRUD
│   ├── profile/            # User profile
│   └── system/             # Health checks, retention
├── help/                   # In-app user guides (markdown-rendered)
└── poll/[id]/              # Public participant view

components/                 # React components (domain-organized)
├── admin/                  # PollForm, QRCode, TeamSelector
├── auth/                   # AuthForm
├── canvas/                 # Drag-and-drop poll canvas editor
├── error/                  # ErrorBoundary, banners
├── facilitator/            # Live session controls
├── help/                   # MarkdownRenderer
├── participant/            # ParticipantForm, PinEntryForm
├── results/                # ResultsDisplay
└── retro/                  # Retro board UI (lanes, cards, votes, export)

lib/                        # Shared logic and services
├── api/                    # API error utilities, retro guard
├── db/                     # Prisma client singleton
├── hooks/                  # Custom React hooks (useAuth, useApi, etc.)
├── retro/                  # Retro services (images, PDF, templates)
├── services/               # Business logic (pollService, retroService, teamService, auditLogger, tokenService)
├── storage/                # Supabase Storage adapter
├── supabase/               # Supabase client factories (browser, server, middleware)
├── utils/                  # Sanitisation, general utilities
├── validators/             # Zod schemas for API input validation
├── config.ts               # Typed environment config
└── featureFlags.ts         # Feature flag definitions

middleware/                 # Auth guard HOF, rate limiting
prisma/                     # Schema, migrations, seed data
tests/                      # Test suites
├── unit/                   # Unit tests
├── integration/            # Integration tests
├── properties/             # Property-based tests (fast-check)
├── smoke/                  # Smoke tests (real DB, separate vitest config)
└── components/             # Component tests (RTL)
scripts/                    # Dev tooling (schema drift, quality review, deploy)
docs/                       # User guides, environment docs
```

## Architectural Patterns

- **Service layer**: All business logic lives in `lib/services/`. Services are factory functions returning typed interfaces. A singleton instance is exported for app-wide use.
- **Auth guard**: API routes use `withAuth(handler)` HOF from `middleware/authGuard.ts`. It resolves the Supabase session and passes `userId` to the handler.
- **Transactional writes**: Mutations run inside Prisma transactions alongside audit log inserts.
- **Feature gating**: Retro features guarded by `isRetroEnabled()` / `RETRO_ENABLED` from `lib/featureFlags.ts`. Server routes and client components both check this flag.
- **Validation**: Zod schemas in `lib/validators/` validate all API inputs before reaching the service layer.
- **Styling**: Pure CSS with design tokens (custom properties). No utility-class frameworks. WCAG AA contrast compliance.
- **Soft deletes**: Records are flagged `isDeleted: true`, never physically removed by application code.
