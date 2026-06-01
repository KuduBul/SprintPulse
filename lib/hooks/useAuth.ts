'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { User, Session } from '@supabase/supabase-js';

/**
 * Custom hook that manages Supabase Auth state.
 * Replaces the legacy useAdminToken hook with proper session-based auth.
 */
export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoaded(true);
    });

    // Subscribe to auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
      }
    );

    return () => subscription.unsubscribe();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const signIn = useCallback(async (email: string, password: string) => {
    return supabase.auth.signInWithPassword({ email, password });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const signUp = useCallback(async (email: string, password: string, displayName: string) => {
    return supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName } },
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const signOut = useCallback(async () => {
    return supabase.auth.signOut();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const resetPassword = useCallback(async (email: string) => {
    return supabase.auth.resetPasswordForEmail(email);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    user,
    session,
    isAuthenticated: !!session,
    isLoaded,
    signIn,
    signUp,
    signOut,
    resetPassword,
  };
}
