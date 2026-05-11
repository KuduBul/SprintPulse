# Design Document: Team-Based Poll Access

## Overview

This feature introduces a **Team** entity that allows facilitators to group polls and restrict participant access via a short PIN code. The system adds a `Team` table to the database, a `teamId` foreign key on `Poll`, a `TeamService` for business logic, API routes for team CRUD and PIN validation, and UI updates to both the facilitator dashboard and participant page.

The design prioritizes backward compatibility — existing polls with no team assignment remain accessible to all participants. New polls require a team assignment, gating participant access behind a PIN entry flow.

## Architecture

```mermaid
graph TD
    subgraph "Participant Flow"
        PP[Participant Page /poll] --> PF[PIN Entry Form]
        PF -->|Submit PIN| VA[/api/teams/validate-pin]
        VA --> TS[TeamService.validatePin]
        TS --> DB[(PostgreSQL)]
        VA -->|teamId| PP
        PP -->|fetch polls by teamId| PPA[/api/polls/public?teamId=X]
        PPA --> PS[PollService.listPublicPollsByTeam]
        PS --> DB
    end

    subgraph "Facilitator Flow"
        AD[Admin Dashboard] --> TM[Teams Management /admin/teams]
        TM --> TA[/api/teams CRUD]
        TA --> TS
        AD --> PC[Poll Create/Edit]
        PC -->|teamId in body| PA[/api/polls]
        PA --> PS
    end

    subgraph "Storage"
        LS[localStorage: team_pin]
    end

    PP -.->|persist PIN| LS
    LS -.->|auto-load PIN| PP
```

### Key Design Decisions

1. **PIN stored in localStorage** (not cookies): Participants are unauthenticated, so there's no session. localStorage persists across browser sessions and is simple to manage client-side.

2. **Nullable `teamId` on Poll**: Ensures backward compatibility. Existing polls continue working without migration of data. Only new polls enforce team assignment.

3. **Soft-delete on Team**: Matches the existing `isDeleted` pattern on `Poll`. When a team is deleted, its polls get `teamId` set to `null` (disassociated), making them visible to all participants again.

4. **4–6 character alphanumeric PIN**: Short enough for verbal sharing in sprint ceremonies, long enough to avoid collisions (36^4 = 1.6M combinations minimum). Generated server-side with retry on collision.

5. **PIN validation as separate endpoint**: Keeps the validation logic decoupled from poll listing. The participant page first validates the PIN, then fetches polls filtered by the returned `teamId`.

## Components and Interfaces

### TeamService (`lib/services/teamService.ts`)

```typescript
export interface TeamService {
  createTeam(name: string, userId: string): Promise<Team>;
  listTeams(userId: string): Promise<Team[]>;
  getTeam(id: string, userId: string): Promise<Team | null>;
  updateTeam(id: string, name: string, userId: string): Promise<Team | null>;
  deleteTeam(id: string, userId: string): Promise<boolean>;
  validatePin(pin: string): Promise<{ teamId: string; teamName: string } | null>;
  generateUniquePin(): Promise<string>;
}
```

### Updated PollService additions

```typescript
// New method signatures added to PollService interface
listPublicPollsByTeam(teamId: string): Promise<Poll[]>;
listPollsByTeam(userId: string, teamId: string): Promise<Poll[]>;
```

### API Routes

| Route | Method | Auth | Description |
|-------|--------|------|-------------|
| `/api/teams` | GET | Required | List facilitator's teams |
| `/api/teams` | POST | Required | Create a new team |
| `/api/teams/[id]` | GET | Required | Get team details |
| `/api/teams/[id]` | PUT | Required | Rename a team |
| `/api/teams/[id]` | DELETE | Required | Soft-delete a team |
| `/api/teams/validate-pin` | POST | None | Validate a PIN, return teamId |
| `/api/polls/public` | GET | None | Updated: accepts optional `teamId` query param |

### Validation Schemas (`lib/validators/schemas.ts`)

```typescript
export const CreateTeamSchema = z.object({
  name: z.string().min(1).max(100),
});

export const UpdateTeamSchema = z.object({
  name: z.string().min(1).max(100),
});

export const ValidatePinSchema = z.object({
  pin: z.string().min(4).max(6),
});

// Updated CreatePollSchema (new polls require teamId)
export const CreatePollSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  teamId: z.string().uuid(),
});
```

### UI Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `PinEntryForm` | `components/participant/PinEntryForm.tsx` | PIN input with validation feedback |
| `TeamSelector` | `components/admin/TeamSelector.tsx` | Dropdown for team selection in poll forms |
| `TeamManagement` | `app/admin/teams/page.tsx` | Full CRUD page for teams |
| Updated `PollForm` | `components/admin/PollForm.tsx` | Add team selector field |
| Updated Participant Page | `app/poll/page.tsx` | PIN gate before poll listing |

## Data Models

### Team (new Prisma model)

```prisma
model Team {
  id        String   @id @default(uuid())
  name      String   @db.VarChar(100)
  pin       String   @unique @db.VarChar(6)
  userId    String
  isDeleted Boolean  @default(false)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  polls     Poll[]

  @@index([userId])
  @@index([pin])
}
```

### Poll (updated)

```prisma
model Poll {
  // ... existing fields ...
  teamId    String?

  team      Team?    @relation(fields: [teamId], references: [id])

  @@index([teamId])
}
```

### PIN Generation Algorithm

```
function generateUniquePin():
  charset = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  // excludes I, O, 0, 1 for readability
  maxAttempts = 10
  for attempt in 1..maxAttempts:
    pin = random(4-6 chars from charset)
    if not exists in DB:
      return pin
  throw Error("PIN generation failed after max attempts")
```

The charset excludes ambiguous characters (I/1, O/0) to reduce verbal communication errors during sprint ceremonies.

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Team creation preserves ownership

*For any* valid team name and facilitator ID, creating a team SHALL produce a team whose `userId` matches the creating facilitator and whose `name` matches the input.

**Validates: Requirements 1.1, 1.5**

### Property 2: PIN generation format and uniqueness

*For any* set of N created teams, each team's PIN SHALL be 4–6 characters long, contain only alphanumeric characters, and be unique across all teams in the set.

**Validates: Requirements 1.2, 1.3**

### Property 3: Invalid team names are rejected

*For any* string that is empty, composed entirely of whitespace, or exceeds 100 characters, the TeamService SHALL reject it with a validation error when used as a team name for creation or rename.

**Validates: Requirements 1.4, 2.3**

### Property 4: Team list ordering

*For any* facilitator with multiple teams, listing their teams SHALL return all non-deleted teams ordered by creation date descending.

**Validates: Requirements 2.1**

### Property 5: Team rename updates name

*For any* existing team and valid new name, renaming the team SHALL result in the team's name equaling the new name while preserving all other fields (id, pin, userId).

**Validates: Requirements 2.2**

### Property 6: Team deletion soft-deletes and disassociates polls

*For any* team with associated polls, deleting the team SHALL set `isDeleted=true` on the team and set `teamId=null` on all previously associated polls.

**Validates: Requirements 2.4**

### Property 7: Authorization prevents cross-user team management

*For any* two distinct facilitators A and B, facilitator B SHALL NOT be able to read, update, or delete teams owned by facilitator A.

**Validates: Requirements 2.5**

### Property 8: Cross-ownership team assignment rejected

*For any* facilitator attempting to assign a poll to a team they do not own, the PollService SHALL reject the request with an authorization error.

**Validates: Requirements 3.4**

### Property 9: Poll filtering by team

*For any* team with associated polls, querying polls by that team's ID SHALL return exactly the set of non-deleted polls whose `teamId` matches, and no others.

**Validates: Requirements 3.6, 4.3**

### Property 10: Valid PIN returns correct team

*For any* existing non-deleted team, submitting that team's PIN for validation SHALL return the correct team ID and team name.

**Validates: Requirements 4.2**

### Property 11: Invalid PIN returns error

*For any* string that does not match any existing non-deleted team's PIN, validation SHALL return a not-found/error response.

**Validates: Requirements 4.4**

### Property 12: Unassigned polls visible to all

*For any* poll with `teamId=null`, that poll SHALL appear in the public poll listing regardless of whether a team filter is applied or which team filter is used.

**Validates: Requirements 6.2**

## Error Handling

| Scenario | HTTP Status | Error Code | Message |
|----------|-------------|------------|---------|
| Invalid team name (empty/too long) | 400 | VALIDATION_ERROR | Descriptive field error |
| Team not found | 404 | NOT_FOUND | "Team not found" |
| Unauthorized team access | 403 | FORBIDDEN | "You do not own this team" |
| Invalid PIN format | 400 | VALIDATION_ERROR | "PIN must be 4-6 characters" |
| PIN not recognized | 404 | NOT_FOUND | "PIN not recognized" |
| Poll creation without teamId | 400 | VALIDATION_ERROR | "Team assignment is required" |
| Team assignment to non-owned team | 403 | FORBIDDEN | "Cannot assign to a team you do not own" |
| PIN generation exhausted | 500 | INTERNAL_ERROR | "Unable to generate PIN, please retry" |

Error responses follow the existing pattern in `lib/api/errors.ts`:
```typescript
{ error: { code: string, message: string, details?: Record<string, string> } }
```

## Testing Strategy

### Property-Based Tests (fast-check)

The project uses TypeScript with Vitest. Property-based tests will use **fast-check** library with a minimum of 100 iterations per property.

Each property test will be tagged with:
```
// Feature: team-based-poll-access, Property {N}: {title}
```

**Properties to test:**
- PIN generation format/uniqueness (Property 2)
- Invalid name rejection (Property 3)
- Team list ordering invariant (Property 4)
- Rename preserves other fields (Property 5)
- Poll filtering correctness (Property 9)
- Valid PIN lookup (Property 10)
- Invalid PIN rejection (Property 11)
- Unassigned polls visibility (Property 12)

### Unit Tests (Vitest)

- TeamService CRUD operations (specific examples)
- PIN validation endpoint (valid/invalid cases)
- Poll creation with/without teamId
- Backward compatibility: editing legacy polls without teamId
- Authorization checks (cross-user scenarios)

### Integration Tests

- Full flow: create team → create poll → validate PIN → see poll
- Team deletion cascading to poll disassociation
- localStorage persistence and auto-load on participant page

### Test File Structure

```
tests/
  unit/
    services/
      teamService.test.ts
    api/
      teams.test.ts
      teams-validate-pin.test.ts
      polls-public-filtered.test.ts
  property/
    teamService.property.test.ts
    pollFiltering.property.test.ts
    pinGeneration.property.test.ts
```
