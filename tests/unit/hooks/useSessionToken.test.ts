/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSessionToken } from '@/lib/hooks/useSessionToken';

// Mock localStorage since jsdom doesn't provide it for opaque origins
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
    get length() { return Object.keys(store).length; },
    key: (index: number) => Object.keys(store)[index] ?? null,
  };
})();

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

describe('useSessionToken', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('getSession', () => {
    it('returns null when no session exists for the poll', () => {
      const { result } = renderHook(() => useSessionToken());
      expect(result.current.getSession('poll-123')).toBeNull();
    });

    it('returns stored session data when session exists', () => {
      localStorage.setItem(
        'session_poll-123',
        JSON.stringify({ name: 'Alice', token: '550e8400-e29b-41d4-a716-446655440000' })
      );
      const { result } = renderHook(() => useSessionToken());
      const session = result.current.getSession('poll-123');
      expect(session).toEqual({
        name: 'Alice',
        token: '550e8400-e29b-41d4-a716-446655440000',
      });
    });

    it('returns null for malformed JSON in localStorage', () => {
      localStorage.setItem('session_poll-123', 'not-json');
      const { result } = renderHook(() => useSessionToken());
      expect(result.current.getSession('poll-123')).toBeNull();
    });

    it('returns null for invalid session data structure', () => {
      localStorage.setItem('session_poll-123', JSON.stringify({ foo: 'bar' }));
      const { result } = renderHook(() => useSessionToken());
      expect(result.current.getSession('poll-123')).toBeNull();
    });
  });

  describe('createSession', () => {
    it('generates a UUID token and stores session in localStorage', () => {
      const { result } = renderHook(() => useSessionToken());
      let token: string = '';
      act(() => {
        token = result.current.createSession('poll-456', 'Bob');
      });

      // Token should be a valid UUID
      expect(token).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );

      // Should be stored in localStorage
      const stored = JSON.parse(localStorage.getItem('session_poll-456')!);
      expect(stored).toEqual({ name: 'Bob', token });
    });

    it('stores sessions independently per poll ID', () => {
      const { result } = renderHook(() => useSessionToken());
      act(() => {
        result.current.createSession('poll-1', 'Alice');
        result.current.createSession('poll-2', 'Bob');
      });

      const session1 = result.current.getSession('poll-1');
      const session2 = result.current.getSession('poll-2');
      expect(session1?.name).toBe('Alice');
      expect(session2?.name).toBe('Bob');
      expect(session1?.token).not.toBe(session2?.token);
    });
  });

  describe('hasSession', () => {
    it('returns false when no session exists', () => {
      const { result } = renderHook(() => useSessionToken());
      expect(result.current.hasSession('poll-789')).toBe(false);
    });

    it('returns true when session exists', () => {
      localStorage.setItem('session_poll-789', JSON.stringify({ name: 'Eve', token: 'abc' }));
      const { result } = renderHook(() => useSessionToken());
      expect(result.current.hasSession('poll-789')).toBe(true);
    });
  });
});
