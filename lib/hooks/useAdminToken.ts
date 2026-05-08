'use client';

/**
 * @deprecated Use useAuth from '@/lib/hooks/useAuth' instead.
 * This hook is kept as a stub to prevent import errors during migration.
 */
export function useAdminToken() {
  return {
    token: null,
    setToken: () => {},
    clearToken: () => {},
    isAuthenticated: false,
    isLoaded: true,
  };
}
