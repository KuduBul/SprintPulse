/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useParticipantToken } from '@/lib/hooks/useParticipantToken';

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

describe('useParticipantToken', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('getParticipant', () => {
    it('returns null when no participant token exists for the board', () => {
      const { result } = renderHook(() => useParticipantToken());
      expect(result.current.getParticipant('board-123')).toBeNull();
    });

    it('returns stored participant data when token exists', () => {
      localStorage.setItem(
        'retro_participant_board-123',
        JSON.stringify({ name: 'Alice', token: '550e8400-e29b-41d4-a716-446655440000' })
      );
      const { result } = renderHook(() => useParticipantToken());
      const participant = result.current.getParticipant('board-123');
      expect(participant).toEqual({
        name: 'Alice',
        token: '550e8400-e29b-41d4-a716-446655440000',
      });
    });

    it('returns null for malformed JSON in localStorage', () => {
      localStorage.setItem('retro_participant_board-123', 'not-json');
      const { result } = renderHook(() => useParticipantToken());
      expect(result.current.getParticipant('board-123')).toBeNull();
    });

    it('returns null for invalid data structure (missing token)', () => {
      localStorage.setItem('retro_participant_board-123', JSON.stringify({ foo: 'bar' }));
      const { result } = renderHook(() => useParticipantToken());
      expect(result.current.getParticipant('board-123')).toBeNull();
    });
  });

  describe('createParticipant', () => {
    it('generates a UUID token and stores participant in localStorage', () => {
      const { result } = renderHook(() => useParticipantToken());
      let token: string = '';
      act(() => {
        token = result.current.createParticipant('board-456', 'Bob');
      });

      // Token should be a valid UUID v4
      expect(token).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );

      // Should be stored in localStorage with the retro prefix
      const stored = JSON.parse(localStorage.getItem('retro_participant_board-456')!);
      expect(stored).toEqual({ name: 'Bob', token });
    });

    it('stores participants independently per board ID', () => {
      const { result } = renderHook(() => useParticipantToken());
      act(() => {
        result.current.createParticipant('board-1', 'Alice');
        result.current.createParticipant('board-2', 'Bob');
      });

      const p1 = result.current.getParticipant('board-1');
      const p2 = result.current.getParticipant('board-2');
      expect(p1?.name).toBe('Alice');
      expect(p2?.name).toBe('Bob');
      expect(p1?.token).not.toBe(p2?.token);
    });

    it('reuses the same token on subsequent calls to getParticipant (persistence)', () => {
      const { result } = renderHook(() => useParticipantToken());
      let token: string = '';
      act(() => {
        token = result.current.createParticipant('board-789', 'Charlie');
      });

      // Simulate page refresh — re-read from storage
      const participant = result.current.getParticipant('board-789');
      expect(participant?.token).toBe(token);
      expect(participant?.name).toBe('Charlie');
    });
  });

  describe('hasParticipant', () => {
    it('returns false when no participant exists', () => {
      const { result } = renderHook(() => useParticipantToken());
      expect(result.current.hasParticipant('board-nope')).toBe(false);
    });

    it('returns true when participant exists', () => {
      localStorage.setItem('retro_participant_board-yes', JSON.stringify({ name: 'Eve', token: 'abc' }));
      const { result } = renderHook(() => useParticipantToken());
      expect(result.current.hasParticipant('board-yes')).toBe(true);
    });
  });

  describe('updateName', () => {
    it('updates the name while preserving the existing token', () => {
      const { result } = renderHook(() => useParticipantToken());
      let token: string = '';
      act(() => {
        token = result.current.createParticipant('board-upd', 'OldName');
      });

      act(() => {
        result.current.updateName('board-upd', 'NewName');
      });

      const participant = result.current.getParticipant('board-upd');
      expect(participant?.name).toBe('NewName');
      expect(participant?.token).toBe(token);
    });

    it('does nothing if no participant exists for the board', () => {
      const { result } = renderHook(() => useParticipantToken());
      act(() => {
        result.current.updateName('board-missing', 'Name');
      });
      expect(result.current.getParticipant('board-missing')).toBeNull();
    });
  });

  describe('getToken', () => {
    it('returns null when no participant exists', () => {
      const { result } = renderHook(() => useParticipantToken());
      expect(result.current.getToken('board-none')).toBeNull();
    });

    it('returns the token string directly', () => {
      localStorage.setItem(
        'retro_participant_board-tok',
        JSON.stringify({ name: 'Dave', token: 'my-uuid-token' })
      );
      const { result } = renderHook(() => useParticipantToken());
      expect(result.current.getToken('board-tok')).toBe('my-uuid-token');
    });
  });

  describe('does not collide with pulse session storage', () => {
    it('uses a different localStorage key prefix than useSessionToken', () => {
      const { result } = renderHook(() => useParticipantToken());
      act(() => {
        result.current.createParticipant('shared-id', 'RetroUser');
      });

      // Pulse session key would be "session_shared-id"
      expect(localStorage.getItem('session_shared-id')).toBeNull();
      // Retro participant key is "retro_participant_shared-id"
      expect(localStorage.getItem('retro_participant_shared-id')).not.toBeNull();
    });
  });
});
