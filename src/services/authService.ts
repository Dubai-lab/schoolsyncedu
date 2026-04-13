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

// ==================== OTP EMAIL VERIFICATION ====================

/**
 * Generate a random 6-digit OTP code
 */
export function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Hash OTP using a simple approach (in production, use bcrypt/argon2)
 * For now, we'll use a basic hash to avoid storing plain OTPs in DB
 */
export function hashOTP(otp: string): string {
  // In production, use: import bcrypt from 'bcryptjs'; return bcrypt.hashSync(otp, 10);
  // For now, use btoa (base64) as a simple obfuscation
  // Server-side RPC should verify the plain OTP, not the hash
  return btoa(`otp:${otp}:salt`);
}

/**
 * Send OTP verification email during registration
 * Calls the send-otp-email Edge Function
 */
export async function sendOTPEmail(email: string, otp: string, schoolName?: string): Promise<void> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  if (!supabaseUrl) throw new Error('VITE_SUPABASE_URL not configured');

  const functionUrl = `${supabaseUrl}/functions/v1/send-otp-email`;

  const response = await fetch(functionUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      to: email,
      otp_code: otp,
      school_name: schoolName || 'SchoolSync',
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to send OTP email');
  }
}

/**
 * Store OTP in database via RPC
 */
export async function storeOTP(
  email: string,
  otp: string,
  expiryMinutes: number = 15,
): Promise<void> {
  const otpHash = hashOTP(otp);
  const expiresAt = new Date(Date.now() + expiryMinutes * 60000).toISOString();

  const { error } = await supabase.rpc('store_otp', {
    p_email: email,
    p_otp_code: otp,
    p_otp_hash: otpHash,
    p_expires_at: expiresAt,
  });

  if (error) throw error;
}

/**
 * Verify OTP code via RPC
 * Returns: { success: boolean; message: string; is_expired: boolean }
 */
export async function verifyOTP(
  email: string,
  otpCode: string,
): Promise<{
  success: boolean;
  message: string;
  is_expired: boolean;
}> {
  const { data, error } = await supabase.rpc('verify_otp', {
    p_email: email,
    p_otp_code: otpCode,
  });

  if (error) throw error;

  const result = Array.isArray(data) ? data[0] : data;
  return {
    success: result?.success ?? false,
    message: result?.message ?? 'Unknown error',
    is_expired: result?.is_expired ?? false,
  };
}

/**
 * Check if email is already verified
 */
export async function checkEmailVerificationStatus(email: string): Promise<{
  verified: boolean;
  verified_at: string | null;
}> {
  const { data, error } = await supabase.rpc('is_email_verified', {
    p_email: email,
  });

  if (error) {
    // If RPC doesn't find it, return not verified
    return { verified: false, verified_at: null };
  }

  const result = Array.isArray(data) ? data[0] : data;
  return {
    verified: result?.verified ?? false,
    verified_at: result?.verified_at ?? null,
  };
}

/**
 * Request a new OTP email (generates + sends + stores)
 * Replaces any previous unverified OTP for this email
 */
export async function requestOTPEmail(
  email: string,
  schoolName?: string,
  expiryMinutes: number = 15,
): Promise<void> {
  // 1. Generate OTP
  const otp = generateOTP();

  // 2. Store in database
  await storeOTP(email, otp, expiryMinutes);

  // 3. Send via email
  await sendOTPEmail(email, otp, schoolName);
}
