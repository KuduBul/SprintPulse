# SprintPulse — System Administrator Guide

## Overview

As a system administrator, you are responsible for deploying, configuring, and maintaining SprintPulse. This guide covers setup, environment configuration, database management, and operational tasks.

---

## System Architecture

The application consists of:

- **Frontend & API:** Next.js 14+ (App Router) deployed on Vercel
- **Database:** Supabase Postgres (managed PostgreSQL)
- **Storage:** Supabase Storage (for background images)
- **Authentication:** Shared secret token (Phase 1)

---

## Deployment

### Prerequisites

- Node.js 18+ installed
- A Supabase project (free tier is sufficient)
- A Vercel account (for deployment)
- Git repository (for CI/CD)

### Initial Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/KuduBul/shoprite-x-polling-app.git
   cd shoprite-x-polling-app
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment variables** (see section below)

4. **Set up the database:**
   - Go to Supabase Dashboard → SQL Editor
   - Run `prisma/init.sql` to create tables
   - Optionally run `prisma/seed.sql` for sample data

5. **Generate Prisma client:**
   ```bash
   npx prisma generate
   ```

6. **Start development server:**
   ```bash
   npm run dev
   ```

7. **Deploy to Vercel:**
   ```bash
   vercel deploy --prod
   ```

---

## Environment Variables

Create a `.env` file in the project root:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | — | Supabase Postgres connection string (pooler, port 6543) |
| `DIRECT_URL` | Yes | — | Direct Supabase connection (port 5432, for migrations) |
| `ADMIN_SECRET` | Yes | — | Shared secret for admin API authentication |
| `RETENTION_RESPONSES_DAYS` | No | 90 | Days to retain poll responses before purge |
| `RETENTION_AUDIT_DAYS` | No | 365 | Days to retain audit logs before purge |
| `POLL_INTERVAL_MS` | No | 3000 | Client polling interval for live results (ms) |
| `SUPABASE_URL` | Yes | — | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | — | Supabase service role key (for storage) |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | — | Public Supabase URL (for client-side) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | — | Public anon key (for client-side) |

### Connection String Format

For IPv6-only Supabase projects (newer projects):
```
DATABASE_URL="postgresql://postgres.[project-ref]:[password]@aws-1-[region].pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.[project-ref]:[password]@aws-1-[region].pooler.supabase.com:5432/postgres"
```

### Security Notes

- Use a strong, unique `ADMIN_SECRET` (minimum 16 characters recommended)
- Never commit `.env` to version control
- Rotate the admin secret periodically
- The service role key has full database access — keep it server-side only

---

## Database Management

### Schema

The database has 4 tables:

| Table | Purpose |
|-------|---------|
| `Poll` | Poll metadata, facilitator state, soft-delete flag |
| `Question` | Questions with options, positions, display order |
| `Response` | Participant responses with deduplication constraint |
| `AuditLog` | Immutable action log for governance |

### Running Migrations

```bash
npx prisma db push    # Push schema changes to database
npx prisma generate   # Regenerate client after schema changes
```

### Backup

Supabase provides automatic daily backups on paid plans. For free tier:
- Use `pg_dump` via the Supabase CLI
- Or export data via the Supabase Dashboard

---

## Data Retention & Purge

The system automatically purges old data:

| Data Type | Retention Period | Configurable Via |
|-----------|-----------------|------------------|
| Poll responses | 90 days | `RETENTION_RESPONSES_DAYS` |
| Audit logs | 365 days | `RETENTION_AUDIT_DAYS` |
| Soft-deleted polls | 30 days (hard-delete) | Not configurable |

### Automated Purge

- Configured via Vercel Cron (`vercel.json`)
- Runs daily at **02:00 UTC**
- Endpoint: `POST /api/system/purge`
- Logs a `DATA_PURGED` audit entry with counts

### Manual Purge

```bash
curl -X POST https://your-app.vercel.app/api/system/purge
```

---

## Rate Limiting

- **Limit:** 60 requests per minute per IP address
- **Scope:** All public endpoints (participant-facing)
- **Response:** HTTP 429 with `RATE_LIMITED` error code
- **Implementation:** In-memory sliding window (resets on server restart)

---

## Audit Logging

All significant actions are logged immutably:

| Action | Trigger |
|--------|---------|
| `POLL_CREATED` | Admin creates a poll |
| `POLL_UPDATED` | Admin updates poll metadata |
| `POLL_DELETED` | Admin soft-deletes a poll |
| `POLL_CLONED` | Admin clones a poll |
| `QUESTION_CREATED` | Admin adds a question |
| `QUESTION_UPDATED` | Admin modifies a question |
| `QUESTION_DELETED` | Admin removes a question |
| `RESPONSES_SUBMITTED` | Participant submits responses |
| `RESPONSES_RESET` | Admin resets poll responses |
| `FACILITATOR_SESSION_STARTED` | Facilitator opens dashboard |
| `FACILITATOR_STATE_UPDATED` | Any facilitator control change |
| `REVEAL_STAGE_CHANGED` | Reveal stage toggled |
| `VOTING_OPENED` / `VOTING_CLOSED` | Voting toggled |
| `DATA_PURGED` | Automated purge executed |

### Querying Audit Logs

Via Supabase SQL Editor:
```sql
SELECT * FROM "AuditLog" 
WHERE "pollId" = 'your-poll-id' 
ORDER BY "createdAt" DESC 
LIMIT 50;
```

---

## Monitoring & Troubleshooting

### Health Checks

- The app responds to any route — a 200 on `/` confirms it's running
- Check Vercel deployment logs for server errors
- Check Supabase Dashboard → Logs for database issues

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| 401 on all admin routes | Wrong `ADMIN_SECRET` | Verify env var matches what users enter |
| Database connection timeout | Wrong connection string | Check `DATABASE_URL` format and region |
| "Tenant or user not found" | Wrong pooler region | Verify the `aws-X-[region]` in your URL |
| Images not uploading | Missing storage config | Check `SUPABASE_SERVICE_ROLE_KEY` |
| Cron not running | Vercel config issue | Verify `vercel.json` cron configuration |

### Performance

- Designed for **100 concurrent participants** per poll
- API responses target **<500ms at p95**
- Database connection pool: **10 connections**
- Client polling interval: **3 seconds**

---

## Scaling Considerations

### Current Limitations (Phase 1)

- In-memory rate limiter resets on deploy/restart
- No WebSocket support (polling-based updates)
- Single admin secret (no per-user accounts)
- No horizontal scaling for rate limiting

### Future Phases

- **Phase 2:** Per-user authentication, persistent rate limiting
- **Phase 3:** Supabase Realtime for instant updates, WebSocket support

---

## Security Checklist

- [ ] Strong `ADMIN_SECRET` configured (16+ characters)
- [ ] `.env` file excluded from version control
- [ ] Supabase RLS policies reviewed (currently disabled for app access)
- [ ] Service role key only used server-side
- [ ] Rate limiting active on public endpoints
- [ ] XSS sanitisation active on free-text inputs
- [ ] HTTPS enforced (automatic on Vercel)

---

*SprintPulse v1.0.0*
