'use client';

import { useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';

/**
 * Participant data stored in localStorage per retro board.
 * Mirrors the existing session storage pattern from useSessionToken.
 */
export interface ParticipantData {
  name: string;
  token: string;
}

/**
 * Returns the localStorage key for a given board/poll ID.
 * Uses a distinct prefix to avoid collisions with the pulse session tokens.
 */
function storageKey(boardId: string): string {
  return `retro_participant_${boardId}`;
}

/**
 * Custom hook for managing persistent participant tokens per retro board.
 *
 * A participant token is a UUID that persists across page refreshes. It is used
 * as both `authorToken` (to own cards) and `voterToken` (to cap votes) in the
 * retro API calls. The participant's display name is stored alongside.
 *
 * This mirrors the existing `useSessionToken` pattern but is scoped to retro
 * boards and persists the same token on return visits (Requirements 4.2, 4.3).
 *
 * Storage key: `retro_participant_{boardId}` → `{ name, token }`
 *
 * Usage:
 * ```tsx
 * const { getParticipant, createParticipant, hasParticipant } = useParticipantToken();
 *
 * // On join:
 * const existing = getParticipant(boardId);
 * if (existing) {
 *   // Returning participant — reuse their token
 *   callApi({ authorToken: existing.token, authorName: existing.name, ... });
 * } else {
 *   // First time — create and persist
 *   const token = createParticipant(boardId, name);
 *   callApi({ authorToken: token, authorName: name, ... });
 * }
 * ```
 */
export function useParticipantToken() {
  /**
   * Retrieve the stored participant data for a retro board.
   * Returns null if no token exists or the stored data is malformed.
   */
  const getParticipant = useCallback((boardId: string): ParticipantData | null => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem(storageKey(boardId));
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.name === 'string' && typeof parsed.token === 'string') {
        return parsed as ParticipantData;
      }
      return null;
    } catch {
      return null;
    }
  }, []);

  /**
   * Create a new participant token for a retro board and persist it.
   * Generates a UUID and stores {name, token} in localStorage.
   * Returns the generated token.
   */
  const createParticipant = useCallback((boardId: string, name: string): string => {
    const token = uuidv4();
    const data: ParticipantData = { name, token };
    localStorage.setItem(storageKey(boardId), JSON.stringify(data));
    return token;
  }, []);

  /**
   * Check if a participant token already exists for a given board.
   */
  const hasParticipant = useCallback((boardId: string): boolean => {
    if (typeof window === 'undefined') return false;
    try {
      const raw = localStorage.getItem(storageKey(boardId));
      return raw !== null;
    } catch {
      return false;
    }
  }, []);

  /**
   * Update the stored participant name (e.g., if the user re-enters their name).
   * Preserves the existing token. No-op if no participant exists for the board.
   */
  const updateName = useCallback((boardId: string, name: string): void => {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(storageKey(boardId));
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.token === 'string') {
        const updated: ParticipantData = { name, token: parsed.token };
        localStorage.setItem(storageKey(boardId), JSON.stringify(updated));
      }
    } catch {
      // Ignore storage errors silently
    }
  }, []);

  /**
   * Get the participant token value directly, or null if none stored.
   * Convenience for passing as authorToken/voterToken in API calls.
   */
  const getToken = useCallback((boardId: string): string | null => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem(storageKey(boardId));
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.token === 'string') {
        return parsed.token;
      }
      return null;
    } catch {
      return null;
    }
  }, []);

  return { getParticipant, createParticipant, hasParticipant, updateName, getToken };
}
