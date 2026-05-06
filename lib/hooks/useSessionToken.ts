'use client';

import { useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';

/**
 * Session data stored in localStorage per poll.
 */
interface SessionData {
  name: string;
  token: string;
}

/**
 * Returns the localStorage key for a given poll ID.
 */
function storageKey(pollId: string): string {
  return `session_${pollId}`;
}

/**
 * Custom hook for managing participant session tokens per poll.
 * Stores in localStorage keyed by poll ID: `session_{pollId}` → `{name, token}`
 */
export function useSessionToken() {
  const getSession = useCallback((pollId: string): SessionData | null => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem(storageKey(pollId));
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.name === 'string' && typeof parsed.token === 'string') {
        return parsed as SessionData;
      }
      return null;
    } catch {
      return null;
    }
  }, []);

  const createSession = useCallback((pollId: string, name: string): string => {
    const token = uuidv4();
    const data: SessionData = { name, token };
    localStorage.setItem(storageKey(pollId), JSON.stringify(data));
    return token;
  }, []);

  const hasSession = useCallback((pollId: string): boolean => {
    if (typeof window === 'undefined') return false;
    try {
      const raw = localStorage.getItem(storageKey(pollId));
      return raw !== null;
    } catch {
      return false;
    }
  }, []);

  return { getSession, createSession, hasSession };
}
