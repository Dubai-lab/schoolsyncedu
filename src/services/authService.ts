import { supabase } from '@/lib/supabase';
import type { User } from '@/types';

export const authService = {
  /** Sign in with email & password */
  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    return data;
  },

  /** Sign up a new user (school registration flow) */
  async signUp(email: string, password: string, metadata?: Record<string, unknown>) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: metadata },
    });
    if (error) throw error;
    return data;
  },

  /** Sign out */
  async signOut() {
    const { error } = await supabase.auth.signOut({ scope: 'global' });
    if (error) throw error;
  },

  /** Send password reset email */
  async resetPassword(email: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });
    if (error) throw error;
  },

  /** Update password (after reset or from profile) */
  async updatePassword(newPassword: string) {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });
    if (error) throw error;
  },

  /** Get current Supabase session (reads from localStorage — fast, no network call) */
  async getSession() {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data.session;
  },

  /**
   * Fetch the public.users record linked to the current auth user.
   * Uses getSession() (localStorage) instead of getUser() (network call)
   * to avoid navigator.lock contention and network failures on page refresh.
   */
  async getCurrentUser(): Promise<User | null> {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user) return null;

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('auth_id', session.user.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // No row found
      throw error;
    }
    return data as User;
  },

  /** Fetch user by ID */
  async getUserById(userId: string): Promise<User | null> {
    const { data, error } = await supabase.from('users').select('*').eq('id', userId).single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return data as User;
  },
};
