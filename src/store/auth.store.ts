import { create } from 'zustand';
import type { User } from '@/types';

interface AuthState {
  user: User | null;
  schoolSlug: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

interface AuthActions {
  setUser: (user: User | null, schoolSlug?: string | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const initialState: AuthState = {
  user: null,
  schoolSlug: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,
};

const SLUG_KEY = 'schoolsync_school_slug';

export const useAuthStore = create<AuthState & AuthActions>()((set) => ({
  ...initialState,

  setUser: (user, schoolSlug) => {
    const slug = schoolSlug ?? null;
    // Persist slug so RequireAuth can redirect to the right school login page
    // even when the user is not authenticated (e.g. copying a link to a new browser).
    if (slug) {
      localStorage.setItem(SLUG_KEY, slug);
    }
    set({
      user,
      schoolSlug: slug,
      isAuthenticated: !!user,
      isLoading: false,
      error: null,
    });
  },

  setLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error, isLoading: false }),

  // Keep slug in localStorage on sign-out so the redirect still works.
  reset: () => set({ ...initialState, isLoading: false }),
}));

/** Returns the last known school slug from localStorage (survives sign-out). */
export function getPersistedSchoolSlug(): string | null {
  try { return localStorage.getItem(SLUG_KEY); } catch { return null; }
}
