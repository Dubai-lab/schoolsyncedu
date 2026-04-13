-- Migration: Create email_verifications table for OTP-based email verification
-- Purpose: Platform-level email verification during school registration
-- Usage: Used in RegisterSchool flow before school is created

-- ============================================================================
-- Create email_verifications table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.email_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  otp_code VARCHAR(6) NOT NULL,
  otp_hash VARCHAR(255) NOT NULL,
  attempts INTEGER DEFAULT 0,
  is_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  verified_at TIMESTAMP WITH TIME ZONE,
  
  -- Constraints
  CONSTRAINT email_verifications_email_check CHECK (email ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$'),
  CONSTRAINT email_verifications_otp_length CHECK (LENGTH(otp_code) = 6 AND otp_code ~ '^\d+$'),
  CONSTRAINT email_verifications_attempts_check CHECK (attempts >= 0 AND attempts <= 10),
  CONSTRAINT email_verifications_verified_check CHECK (
    (is_verified = false AND verified_at IS NULL) OR 
    (is_verified = true AND verified_at IS NOT NULL)
  )
);

-- ============================================================================
-- Indexes for performance
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_email_verifications_email ON public.email_verifications(email);
CREATE INDEX IF NOT EXISTS idx_email_verifications_created_at ON public.email_verifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_verifications_is_verified ON public.email_verifications(is_verified);
CREATE INDEX IF NOT EXISTS idx_email_verifications_expires_at ON public.email_verifications(expires_at);

-- ============================================================================
-- RPC: Insert or update OTP for email
-- ============================================================================
CREATE OR REPLACE FUNCTION public.store_otp(
  p_email VARCHAR,
  p_otp_code VARCHAR,
  p_otp_hash VARCHAR,
  p_expires_at TIMESTAMP WITH TIME ZONE
) RETURNS VOID AS $$
BEGIN
  INSERT INTO public.email_verifications (email, otp_code, otp_hash, expires_at, attempts)
  VALUES (p_email, p_otp_code, p_otp_hash, p_expires_at, 0)
  ON CONFLICT (email) DO UPDATE SET
    otp_code = EXCLUDED.otp_code,
    otp_hash = EXCLUDED.otp_hash,
    expires_at = EXCLUDED.expires_at,
    attempts = 0,
    is_verified = false,
    verified_at = NULL,
    created_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- RPC: Verify OTP and increment attempt count
-- ============================================================================
CREATE OR REPLACE FUNCTION public.verify_otp(
  p_email VARCHAR,
  p_otp_code VARCHAR
) RETURNS TABLE (
  success BOOLEAN,
  message TEXT,
  is_expired BOOLEAN
) AS $$
DECLARE
  v_record RECORD;
  v_now TIMESTAMP WITH TIME ZONE;
BEGIN
  v_now := now();
  
  -- Fetch the verification record
  SELECT * INTO v_record FROM public.email_verifications
  WHERE email = p_email
  LIMIT 1;
  
  -- If no record exists
  IF v_record IS NULL THEN
    RETURN QUERY SELECT false, 'No verification found for this email'::TEXT, false::BOOLEAN;
    RETURN;
  END IF;
  
  -- If already expired
  IF v_now > v_record.expires_at THEN
    UPDATE public.email_verifications SET attempts = attempts + 1
    WHERE email = p_email;
    RETURN QUERY SELECT false, 'OTP has expired. Please request a new one.'::TEXT, true::BOOLEAN;
    RETURN;
  END IF;
  
  -- If max attempts exceeded
  IF v_record.attempts >= 10 THEN
    RETURN QUERY SELECT false, 'Too many failed attempts. Please request a new OTP.'::TEXT, false::BOOLEAN;
    RETURN;
  END IF;
  
  -- If OTP is incorrect
  IF v_record.otp_code != p_otp_code THEN
    UPDATE public.email_verifications SET attempts = attempts + 1
    WHERE email = p_email;
    RETURN QUERY SELECT false, 'Incorrect OTP code. Please try again.'::TEXT, false::BOOLEAN;
    RETURN;
  END IF;
  
  -- OTP is correct — mark as verified
  UPDATE public.email_verifications
  SET is_verified = true, verified_at = v_now
  WHERE email = p_email;
  
  RETURN QUERY SELECT true, 'Email verified successfully'::TEXT, false::BOOLEAN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- RPC: Check if email is verified
-- ============================================================================
CREATE OR REPLACE FUNCTION public.is_email_verified(p_email VARCHAR)
RETURNS TABLE (
  verified BOOLEAN,
  verified_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT ev.is_verified, ev.verified_at
  FROM public.email_verifications ev
  WHERE ev.email = p_email
  LIMIT 1;
  
  -- If no record, return false
  IF NOT FOUND THEN
    RETURN QUERY SELECT false::BOOLEAN, NULL::TIMESTAMP WITH TIME ZONE;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- RPC: Clean up expired OTPs (run periodically or on-demand)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.cleanup_expired_otps()
RETURNS TABLE (
  deleted_count INTEGER
) AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM public.email_verifications
  WHERE expires_at < now() AND is_verified = false;
  
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN QUERY SELECT v_deleted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Grant permissions (anon can call store/verify, authenticated can check status)
-- ============================================================================
GRANT EXECUTE ON FUNCTION public.store_otp TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_otp TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_email_verified TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_otps TO authenticated, service_role;
