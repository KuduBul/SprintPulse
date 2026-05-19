import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';

/**
 * Feature: shoprite-x-polling-app
 * Property 9: Session token persistence round-trip
 *
 * Validates: Requirements 4.2, 4.3
 *
 * For any valid participant name (2–50 characters) and poll ID, generating a
 * session token and storing it in localStorage, then retrieving it, SHALL return
 * the same participant name.
 */

// ─── localStorage mock ───────────────────────────────────────────────────────

let store: Record<string, string> = {};

const localStorageMock: Storage = {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => {
    store[key] = value;
  },
  removeItem: (key: string) => {
    delete store[key];
  },
  clear: () => {
    store = {};
  },
  get length() {
    return Object.keys(store).length;
  },
  key: (index: number) => Object.keys(store)[index] ?? null,
};

// ─── Pure session logic extracted from useSessionToken hook ──────────────────

interface SessionData {
  name: string;
  token: string;
}

function storageKey(pollId: string): string {
  return `session_${pollId}`;
}

/**
 * Simulates createSession: generates a UUID token, stores {name, token} in localStorage.
 */
function createSession(storage: Storage, pollId: string, name: string): string {
  const token = crypto.randomUUID();
  const data: SessionData = { name, token };
  storage.setItem(storageKey(pollId), JSON.stringify(data));
  return token;
}

/**
 * Simulates getSession: retrieves and parses session data from localStorage.
 */
function getSession(storage: Storage, pollId: string): SessionData | null {
  try {
    const raw = storage.getItem(storageKey(pollId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.name === 'string' && typeof parsed.token === 'string') {
      return parsed as SessionData;
    }
    return null;
  } catch {
    return null;
  }
}

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/**
 * Generates valid participant names: 2–50 printable characters.
 */
const participantNameArb = fc.string({ minLength: 2, maxLength: 50 }).filter((s) => s.trim().length >= 2);

/**
 * Generates valid poll IDs (UUIDs).
 */
const pollIdArb = fc.uuid();

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('Feature: shoprite-x-polling-app, Property 9: Session token persistence round-trip', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  afterEach(() => {
    localStorageMock.clear();
  });

  it('creating a session and retrieving it returns the same participant name', () => {
    fc.assert(
      fc.property(pollIdArb, participantNameArb, (pollId, name) => {
        // Clear storage between iterations
        localStorageMock.clear();

        // Act: create session (stores in localStorage)
        const token = createSession(localStorageMock, pollId, name);

        // Act: retrieve session from localStorage
        const retrieved = getSession(localStorageMock, pollId);

        // Assert: retrieved session contains the same participant name
        expect(retrieved).not.toBeNull();
        expect(retrieved!.name).toBe(name);
        // Assert: retrieved token matches the one returned by createSession
        expect(retrieved!.token).toBe(token);
      }),
      { numRuns: 100 },
    );
  });

  it('session token is a valid UUID', () => {
    fc.assert(
      fc.property(pollIdArb, participantNameArb, (pollId, name) => {
        localStorageMock.clear();

        const token = createSession(localStorageMock, pollId, name);

        // UUID v4 format: 8-4-4-4-12 hex characters
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        expect(token).toMatch(uuidRegex);
      }),
      { numRuns: 100 },
    );
  });

  it('different poll IDs produce independent sessions', () => {
    fc.assert(
      fc.property(
        pollIdArb,
        pollIdArb,
        participantNameArb,
        participantNameArb,
        (pollId1, pollId2, name1, name2) => {
          // Precondition: poll IDs must be different
          fc.pre(pollId1 !== pollId2);
          localStorageMock.clear();

          // Create sessions for two different polls
          createSession(localStorageMock, pollId1, name1);
          createSession(localStorageMock, pollId2, name2);

          // Retrieve each session independently
          const session1 = getSession(localStorageMock, pollId1);
          const session2 = getSession(localStorageMock, pollId2);

          // Each session returns its own participant name
          expect(session1).not.toBeNull();
          expect(session1!.name).toBe(name1);
          expect(session2).not.toBeNull();
          expect(session2!.name).toBe(name2);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('getSession returns null for a poll with no stored session', () => {
    fc.assert(
      fc.property(pollIdArb, (pollId) => {
        localStorageMock.clear();

        const session = getSession(localStorageMock, pollId);
        expect(session).toBeNull();
      }),
      { numRuns: 100 },
    );
  });
});
