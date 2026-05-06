'use client';

import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'adminToken';

/**
 * Custom hook that manages the admin token from localStorage.
 * Returns the token, a setter, and an authentication status flag.
 */
export function useAdminToken() {
  const [token, setTokenState] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      setTokenState(stored);
    }
    setIsLoaded(true);
  }, []);

  const setToken = useCallback((newToken: string) => {
    localStorage.setItem(STORAGE_KEY, newToken);
    setTokenState(newToken);
  }, []);

  const clearToken = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setTokenState(null);
  }, []);

  return {
    token,
    setToken,
    clearToken,
    isAuthenticated: !!token,
    isLoaded,
  };
}
