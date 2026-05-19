/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// Mock the Supabase browser client
const mockSignInWithPassword = vi.fn();
const mockSignUp = vi.fn();
const mockSignOut = vi.fn();
const mockGetSession = vi.fn();
const mockOnAuthStateChange = vi.fn();

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getSession: mockGetSession,
      signInWithPassword: mockSignInWithPassword,
      signUp: mockSignUp,
      signOut: mockSignOut,
      onAuthStateChange: mockOnAuthStateChange,
    },
  }),
}));

import { useAuth } from '@/lib/hooks/useAuth';

describe('useAuth hook', () => {
  let authStateCallback: (event: string, session: any) => void;

  beforeEach(() => {
    vi.clearAllMocks();

    // Default: no session, capture the onAuthStateChange callback
    mockGetSession.mockResolvedValue({ data: { session: null } });
    mockOnAuthStateChange.mockImplementation((callback) => {
      authStateCallback = callback;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });
  });

  describe('initial state is unauthenticated', () => {
    it('starts with user as null, session as null, and isAuthenticated as false', async () => {
      const { result } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(result.current.isLoaded).toBe(true);
      });

      expect(result.current.user).toBeNull();
      expect(result.current.session).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
    });

    it('sets isLoaded to true after getSession resolves', async () => {
      const { result } = renderHook(() => useAuth());

      // Initially isLoaded may be false
      await waitFor(() => {
        expect(result.current.isLoaded).toBe(true);
      });
    });

    it('subscribes to onAuthStateChange on mount', () => {
      renderHook(() => useAuth());

      expect(mockOnAuthStateChange).toHaveBeenCalledTimes(1);
      expect(mockOnAuthStateChange).toHaveBeenCalledWith(expect.any(Function));
    });

    it('unsubscribes from onAuthStateChange on unmount', () => {
      const mockUnsubscribe = vi.fn();
      mockOnAuthStateChange.mockImplementation((callback) => {
        authStateCallback = callback;
        return { data: { subscription: { unsubscribe: mockUnsubscribe } } };
      });

      const { unmount } = renderHook(() => useAuth());
      unmount();

      expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
    });
  });

  describe('signIn calls supabase.auth.signInWithPassword', () => {
    it('calls signInWithPassword with email and password', async () => {
      const mockResponse = {
        data: { user: { id: 'user-1' }, session: { access_token: 'token' } },
        error: null,
      };
      mockSignInWithPassword.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(result.current.isLoaded).toBe(true);
      });

      let response: any;
      await act(async () => {
        response = await result.current.signIn('test@example.com', 'password123');
      });

      expect(mockSignInWithPassword).toHaveBeenCalledTimes(1);
      expect(mockSignInWithPassword).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
      });
      expect(response).toEqual(mockResponse);
    });

    it('returns error response when credentials are invalid', async () => {
      const mockErrorResponse = {
        data: { user: null, session: null },
        error: { message: 'Invalid login credentials' },
      };
      mockSignInWithPassword.mockResolvedValue(mockErrorResponse);

      const { result } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(result.current.isLoaded).toBe(true);
      });

      let response: any;
      await act(async () => {
        response = await result.current.signIn('bad@example.com', 'wrong');
      });

      expect(response.error).toBeDefined();
      expect(response.error.message).toBe('Invalid login credentials');
    });
  });

  describe('signOut calls supabase.auth.signOut and clears state', () => {
    it('calls supabase.auth.signOut', async () => {
      mockSignOut.mockResolvedValue({ error: null });

      const { result } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(result.current.isLoaded).toBe(true);
      });

      await act(async () => {
        await result.current.signOut();
      });

      expect(mockSignOut).toHaveBeenCalledTimes(1);
    });

    it('clears user and session state when onAuthStateChange fires SIGNED_OUT', async () => {
      // Start with an active session
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      const mockSession = { access_token: 'token', user: mockUser };
      mockGetSession.mockResolvedValue({ data: { session: mockSession } });

      const { result } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(result.current.isLoaded).toBe(true);
      });

      // Verify initial authenticated state
      expect(result.current.user).toEqual(mockUser);
      expect(result.current.session).toEqual(mockSession);
      expect(result.current.isAuthenticated).toBe(true);

      // Simulate signOut triggering onAuthStateChange with null session
      mockSignOut.mockResolvedValue({ error: null });

      await act(async () => {
        await result.current.signOut();
        // Simulate the auth state change that Supabase fires after signOut
        authStateCallback('SIGNED_OUT', null);
      });

      expect(result.current.user).toBeNull();
      expect(result.current.session).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
    });
  });

  describe('onAuthStateChange updates state', () => {
    it('updates user and session when SIGNED_IN event fires', async () => {
      const { result } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(result.current.isLoaded).toBe(true);
      });

      // Initially unauthenticated
      expect(result.current.isAuthenticated).toBe(false);

      // Simulate auth state change (e.g., user signs in)
      const mockUser = { id: 'user-456', email: 'new@example.com' };
      const mockSession = { access_token: 'new-token', user: mockUser };

      act(() => {
        authStateCallback('SIGNED_IN', mockSession);
      });

      expect(result.current.user).toEqual(mockUser);
      expect(result.current.session).toEqual(mockSession);
      expect(result.current.isAuthenticated).toBe(true);
    });

    it('updates session when TOKEN_REFRESHED event fires', async () => {
      const mockUser = { id: 'user-789', email: 'refresh@example.com' };
      const initialSession = { access_token: 'old-token', user: mockUser };
      mockGetSession.mockResolvedValue({ data: { session: initialSession } });

      const { result } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(result.current.isLoaded).toBe(true);
      });

      // Simulate token refresh
      const refreshedSession = { access_token: 'new-refreshed-token', user: mockUser };

      act(() => {
        authStateCallback('TOKEN_REFRESHED', refreshedSession);
      });

      expect(result.current.session).toEqual(refreshedSession);
      expect(result.current.user).toEqual(mockUser);
      expect(result.current.isAuthenticated).toBe(true);
    });

    it('clears state when SIGNED_OUT event fires', async () => {
      const mockUser = { id: 'user-abc', email: 'out@example.com' };
      const mockSession = { access_token: 'token', user: mockUser };
      mockGetSession.mockResolvedValue({ data: { session: mockSession } });

      const { result } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(result.current.isLoaded).toBe(true);
      });

      expect(result.current.isAuthenticated).toBe(true);

      act(() => {
        authStateCallback('SIGNED_OUT', null);
      });

      expect(result.current.user).toBeNull();
      expect(result.current.session).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
    });

    it('restores session from getSession on mount', async () => {
      const mockUser = { id: 'existing-user', email: 'existing@example.com' };
      const mockSession = { access_token: 'existing-token', user: mockUser };
      mockGetSession.mockResolvedValue({ data: { session: mockSession } });

      const { result } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(result.current.isLoaded).toBe(true);
      });

      expect(result.current.user).toEqual(mockUser);
      expect(result.current.session).toEqual(mockSession);
      expect(result.current.isAuthenticated).toBe(true);
    });
  });
});
