import { createContext, useEffect, useCallback, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { authService } from '@/services/authService';
import { useAuthStore } from '@/store/auth.store';
import type { User } from '@/types';
import type { UserRole } from '@/utils/constants';

interface AuthContextValue {
  user: User | null;
  schoolSlug: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, metadata?: Record<string, unknown>) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  hasRole: (...roles: UserRole[]) => boolean;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { user, schoolSlug, isAuthenticated, isLoading, error, setUser, setLoading, setError, reset } =
    useAuthStore();

  // Fetch public.users record + school slug for a given auth user ID
  const loadUserForAuthId = useCallback(async (authId: string) => {
    try {
      const { data, error: err } = await supabase
        .from('users')
        .select('*, schools!users_school_id_fkey(slug)')
        .eq('auth_id', authId)
        .single();

      if (err) {
        if (err.code === 'PGRST116') { setUser(null); return; }
        throw err;
      }
      const slug = (data as any)?.schools?.slug ?? null;
      setUser(data as User, slug);
    } catch {
      setUser(null);
    }
  }, [setUser]);

  // Bootstrap session on mount + listen for auth changes (token refresh, sign out from other tab)
  useEffect(() => {
    setLoading(true);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'INITIAL_SESSION') {
        // Page load / refresh — restore from localStorage session
        if (session?.user?.id) {
          await loadUserForAuthId(session.user.id);
        } else {
          setUser(null);
        }
      } else if (event === 'TOKEN_REFRESHED') {
        // JWT auto-refreshed — reload profile in case anything changed
        if (session?.user?.id) {
          await loadUserForAuthId(session.user.id);
        }
      } else if (event === 'SIGNED_OUT') {
        reset();
      }
      // NOTE: We do NOT handle SIGNED_IN here.
      // signIn() below loads the user directly after success.
      // This avoids race conditions with the event system.
    });

    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signIn = useCallback(
    async (email: string, password: string) => {
      setLoading(true);
      setError(null);
      try {
        const result = await authService.signIn(email, password);
        // Load user profile DIRECTLY — don't rely on onAuthStateChange events
        if (result.user?.id) {
          await loadUserForAuthId(result.user.id);
          // Update last_login timestamp — fire-and-forget, never block login
          supabase.rpc('record_login').then(() => {}, () => {});
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Sign in failed';
        setError(message);
        setLoading(false);
        throw err;
      }
    },
    [setLoading, setError, loadUserForAuthId],
  );

  const signUp = useCallback(
    async (email: string, password: string, metadata?: Record<string, unknown>) => {
      setLoading(true);
      setError(null);
      try {
        await authService.signUp(email, password, metadata);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Sign up failed';
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [setLoading, setError],
  );

  const signOut = useCallback(async () => {
    try {
      await authService.signOut();
      reset();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Sign out failed';
      setError(message);
    }
  }, [reset, setError]);

  const resetPassword = useCallback(
    async (email: string) => {
      setLoading(true);
      setError(null);
      try {
        await authService.resetPassword(email);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Reset failed';
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [setLoading, setError],
  );

  const hasRole = useCallback(
    (...roles: UserRole[]) => {
      if (!user) return false;
      return roles.includes(user.role as UserRole);
    },
    [user],
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        schoolSlug,
        isAuthenticated,
        isLoading,
        error,
        signIn,
        signUp,
        signOut,
        resetPassword,
        hasRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}