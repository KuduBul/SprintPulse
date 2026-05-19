# Implementation Plan: Secure Poll URL Access

## Overview

Replace the existing PIN-based participant access system with unique, cryptographically secure URLs per poll. Implementation covers database migration (adding `accessToken` and `tokenExpiresAt` columns), a new `TokenService`, a `QRService`, updated API routes for token-based access, new admin UI components for URL/QR sharing, and removal of the old public poll listing endpoint.

## Tasks

- [ ] 1. Database migration and schema update
  - [ ] 1.1 Apply database migration to add accessToken and tokenExpiresAt columns
    - Add `accessToken` VARCHAR(64) column to Poll table (nullable initially)
    - Add `tokenExpiresAt` TIMESTAMP column to Poll table (nullable)
    - Generate base64url tokens for all existing polls using a PL/pgSQL function
    - Make `accessToken` NOT NULL and add UNIQUE constraint and index
    - Use `mcp_supabase_apply_migration` then run `npx prisma generate`
    - _Requirements: 1.4, 10.1, 10.2, 10.3_

  - [ ] 1.2 Update Prisma schema to reflect new columns
    - Add `accessToken String @unique @db.VarChar(64)` field to Poll model
    - Add `tokenExpiresAt DateTime?` field to Poll model
    - Add `@@index([accessToken])` to Poll model
    - Make `teamId` optional if not already
    - _Requirements: 1.4, 7.2_

- [ ] 2. Implement TokenService
  - [ ] 2.1 Create TokenService with token generation and validation
    - Create `lib/services/tokenService.ts`
    - Implement `generateToken()` using `crypto.randomBytes(24).toString('base64url')`
    - Implement `validateToken(token)` — lookup poll by accessToken, check isDeleted and tokenExpiresAt
    - Implement `regenerateToken(pollId, userId)` — verify ownership, generate new token, update poll
    - Implement `buildPollUrl(token)` — construct full URL from base URL and token
    - Export singleton instance and register in `lib/services/index.ts`
    - _Requirements: 1.1, 1.2, 1.3, 3.1, 6.1, 6.2, 7.3, 7.5, 9.1_

  - [ ]* 2.2 Write property test: Token format and uniqueness (Property 1)
    - **Property 1: Token format and uniqueness**
    - For any set of N generated tokens, each is ≥32 chars, URL-safe, and all are distinct
    - **Validates: Requirements 1.1, 1.3, 2.2**

  - [ ]* 2.3 Write property test: Token validation round-trip (Property 2)
    - **Property 2: Token validation round-trip**
    - For any poll with a stored token (not deleted, not expired), validation returns that exact poll
    - **Validates: Requirements 3.1, 3.4**

  - [ ]* 2.4 Write property test: Invalid token rejection (Property 3)
    - **Property 3: Invalid token rejection**
    - For any string not matching a stored token or matching a deleted poll, validation returns null
    - **Validates: Requirements 3.5, 3.6**

  - [ ]* 2.5 Write property test: Token regeneration invalidates old token (Property 4)
    - **Property 4: Token regeneration invalidates old token**
    - After regeneration, new token differs from old, new validates, old does not
    - **Validates: Requirements 6.1, 6.2**

  - [ ]* 2.6 Write property test: Expiry-based validation (Property 8)
    - **Property 8: Expiry-based validation**
    - Expired tokens fail validation; non-expired and null-expiry tokens succeed
    - **Validates: Requirements 7.2, 7.3, 7.5**

  - [ ]* 2.7 Write unit tests for TokenService
    - Test generateToken format with specific examples
    - Test validateToken with valid, invalid, expired, and deleted poll cases
    - Test regenerateToken ownership check and token replacement
    - _Requirements: 1.1, 1.2, 3.1, 6.1, 6.2, 7.3_

- [ ] 3. Update PollService for token-based access
  - [ ] 3.1 Modify createPoll to generate and store accessToken
    - Import and use `tokenService.generateToken()` in `createPoll`
    - Store generated token in the `accessToken` field on poll creation
    - _Requirements: 1.1, 1.4_

  - [ ] 3.2 Modify clonePoll to generate a new accessToken for the clone
    - Generate a fresh token for the cloned poll (not copy the source token)
    - _Requirements: 1.5_

  - [ ] 3.3 Add getPublicPollByToken method to PollService
    - Implement lookup by accessToken instead of by ID
    - Include questions ordered by displayOrder
    - Return PublicPollView or null
    - _Requirements: 3.2, 3.4_

  - [ ] 3.4 Add listPollsByTeam filter support for facilitator dashboard
    - Ensure existing `listPollsByTeam` works with optional teamId filtering
    - _Requirements: 8.3_

  - [ ]* 3.5 Write property test: Clone produces distinct token (Property 5)
    - **Property 5: Clone produces distinct token**
    - Cloned poll's token differs from original; both validate independently
    - **Validates: Requirements 1.5**

  - [ ]* 3.6 Write property test: Team filter correctness (Property 9)
    - **Property 9: Team filter correctness**
    - Filtering by team returns exactly the non-deleted polls with that team and no others
    - **Validates: Requirements 8.3**

  - [ ]* 3.7 Write property test: Team identifier independence from URL access (Property 10)
    - **Property 10: Team identifier independence from URL access**
    - Regardless of team assignment, token validation grants access identically
    - **Validates: Requirements 8.4**

- [ ] 4. Checkpoint - Core services verified
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Implement QRService
  - [ ] 5.1 Create QRService with QR code generation
    - Create `lib/services/qrService.ts`
    - Install `qrcode` package (`npm install qrcode @types/qrcode`)
    - Implement `generateQRCode(pollUrl)` — returns PNG as data URL (min 300x300)
    - Implement `generateQRCodeBuffer(pollUrl)` — returns PNG Buffer for download
    - Export singleton instance and register in `lib/services/index.ts`
    - _Requirements: 5.1, 5.2_

  - [ ]* 5.2 Write property test: QR code round-trip (Property 7)
    - **Property 7: QR code round-trip**
    - Generating a QR code and decoding it yields the original URL; output is valid PNG ≥300x300
    - **Validates: Requirements 5.1, 5.2, 5.5**

  - [ ]* 5.3 Write unit tests for QRService
    - Test output format is valid PNG data URL
    - Test buffer output is valid PNG
    - Test minimum dimensions
    - _Requirements: 5.1, 5.2_

- [ ] 6. Implement API routes for token-based participant access
  - [ ] 6.1 Create GET /api/polls/by-token/[token] route
    - Create `app/api/polls/by-token/[token]/route.ts`
    - Validate token format (min 32 chars, URL-safe characters)
    - Call `tokenService.validateToken(token)`
    - Return poll data on success, appropriate error responses on failure (404, 410)
    - No authentication required
    - _Requirements: 3.1, 3.2, 3.5, 3.6, 7.3, 7.4_

  - [ ] 6.2 Create POST /api/polls/by-token/[token]/respond route
    - Create `app/api/polls/by-token/[token]/respond/route.ts`
    - Validate token, then accept response submission
    - Reuse existing response submission logic from responseService
    - No authentication required
    - _Requirements: 3.3_

  - [ ] 6.3 Create POST /api/polls/[id]/regenerate-token route
    - Create `app/api/polls/[id]/regenerate-token/route.ts`
    - Require authentication (facilitator must own the poll)
    - Call `tokenService.regenerateToken(pollId, userId)`
    - Return new accessToken and updated poll URL
    - _Requirements: 6.1, 6.2, 6.3_

  - [ ] 6.4 Create GET /api/polls/[id]/qr route
    - Create `app/api/polls/[id]/qr/route.ts`
    - Require authentication
    - Generate QR code for the poll's current URL
    - Return PNG image with appropriate content-type header
    - _Requirements: 5.1, 5.2_

  - [ ]* 6.5 Write property test: URL construction determinism (Property 6)
    - **Property 6: URL construction determinism**
    - For any valid token, constructed URL equals `{BASE_URL}/poll/{token}` and token is extractable
    - **Validates: Requirements 2.1**

  - [ ]* 6.6 Write unit tests for API routes
    - Test by-token route with valid, invalid, expired, and deleted poll tokens
    - Test respond route with valid token
    - Test regenerate-token route with auth and ownership checks
    - Test QR route returns PNG
    - _Requirements: 3.1, 3.5, 3.6, 6.1, 7.4_

- [ ] 7. Checkpoint - API routes verified
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Update participant page routing and UI
  - [ ] 8.1 Create new participant page at app/poll/[token]/page.tsx
    - Create `app/poll/[token]/page.tsx` dynamic route
    - Fetch poll data via `/api/polls/by-token/{token}`
    - Render poll questions and response form (reuse existing participant UI logic)
    - Handle error states: invalid token (404), expired token (410), deleted poll
    - Display appropriate error messages per requirement
    - _Requirements: 3.2, 3.3, 3.4, 3.5, 3.6, 7.4_

  - [ ] 8.2 Create base /poll page with informational message
    - Create `app/poll/page.tsx` (replaces old poll listing)
    - Display message instructing participant to use a shared link or scan a QR code
    - No poll listing, search, or browse interface
    - _Requirements: 4.1, 4.3_

  - [ ] 8.3 Remove old participant page and public poll listing endpoint
    - Remove or redirect old `app/poll/page.tsx` participant listing (replaced by 8.2)
    - Remove `/api/polls/[id]/public` GET route (unauthenticated poll access by ID)
    - Remove `listPublicPolls` and `listPublicPollsByTeam` from pollService (or mark deprecated)
    - _Requirements: 4.1, 4.2, 10.4_

- [ ] 9. Implement admin UI components for URL and QR sharing
  - [ ] 9.1 Create PollUrlDisplay component
    - Create `components/admin/PollUrlDisplay.tsx`
    - Display full poll URL with copy-to-clipboard button
    - Use `tokenService.buildPollUrl(token)` pattern for URL construction
    - _Requirements: 2.1, 2.3, 2.4_

  - [ ] 9.2 Create QRCodeDisplay component
    - Create `components/admin/QRCodeDisplay.tsx`
    - Render QR code using `qrcode` library client-side
    - Include download button (PNG format)
    - _Requirements: 5.3, 5.4_

  - [ ] 9.3 Create TokenRegenerateButton component
    - Create `components/admin/TokenRegenerateButton.tsx`
    - Button with confirmation dialog before regenerating
    - Call `/api/polls/[id]/regenerate-token` on confirm
    - Update displayed URL and QR code after regeneration
    - _Requirements: 6.1, 6.4_

  - [ ] 9.4 Create TokenExpiryField component
    - Create `components/admin/TokenExpiryField.tsx`
    - Optional expiry duration picker (e.g., 1h, 4h, 24h, custom, or no expiry)
    - Integrate into poll create/edit forms
    - _Requirements: 7.1_

  - [ ] 9.5 Integrate new components into poll detail and facilitation pages
    - Add PollUrlDisplay, QRCodeDisplay, and TokenRegenerateButton to poll detail view
    - Add QRCodeDisplay to facilitation screen (`app/admin/polls/[id]/facilitate/page.tsx`)
    - Add TokenExpiryField to poll create/edit forms
    - Make teamId optional in poll create form
    - _Requirements: 2.3, 5.3, 6.4, 7.1, 8.1_

- [ ] 10. Update validation schemas
  - [ ] 10.1 Update CreatePollSchema and UpdatePollSchema
    - Add `tokenExpiresAt` optional datetime field to CreatePollSchema
    - Add `tokenExpiresAt` optional nullable datetime field to UpdatePollSchema
    - Make `teamId` optional in CreatePollSchema (if not already)
    - Add `AccessTokenParamSchema` for token path parameter validation
    - _Requirements: 7.1, 8.1_

- [ ] 11. Add error handling helpers
  - [ ] 11.1 Add tokenExpiredError helper to lib/api/errors.ts
    - Add `tokenExpiredError()` function returning 410 status with TOKEN_EXPIRED code
    - Ensure error response follows existing `{ error: { code, message } }` pattern
    - _Requirements: 7.4_

- [ ] 12. Final checkpoint - Full integration verified
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- Database migration uses `mcp_supabase_apply_migration` followed by `npx prisma generate` (not `prisma migrate`)
- The `qrcode` npm package is used for client-side QR generation; `jsqr` or similar can be used for property test decoding
- Existing participant UI logic should be reused in the new `app/poll/[token]/page.tsx` route

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "11.1"] },
    { "id": 2, "tasks": ["2.1", "10.1"] },
    { "id": 3, "tasks": ["2.2", "2.3", "2.4", "2.5", "2.6", "2.7", "3.1", "3.2", "3.3", "3.4"] },
    { "id": 4, "tasks": ["3.5", "3.6", "3.7", "5.1"] },
    { "id": 5, "tasks": ["5.2", "5.3", "6.1", "6.2", "6.3", "6.4"] },
    { "id": 6, "tasks": ["6.5", "6.6", "8.1", "8.2"] },
    { "id": 7, "tasks": ["8.3", "9.1", "9.2", "9.3", "9.4"] },
    { "id": 8, "tasks": ["9.5"] }
  ]
}
```
