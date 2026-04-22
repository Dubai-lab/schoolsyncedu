-- Migration 076: Fix mutable search_path warnings — batch 6
-- Adds SET search_path = public to 10 functions flagged by Supabase Advisor.

CREATE OR REPLACE FUNCTION public.check_student_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit   INTEGER;
  v_current INTEGER;
BEGIN
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.status = 'enrolled' AND OLD.status <> 'enrolled') THEN
    IF NEW.status = 'enrolled' THEN
      SELECT sp.student_limit INTO v_limit
      FROM subscriptions sub
      JOIN subscription_plans sp ON sp.id = sub.plan_id
      WHERE sub.school_id = NEW.school_id
        AND sub.status IN ('active', 'trial', 'grace')
      ORDER BY sub.created_at DESC
      LIMIT 1;

      IF v_limit IS NULL THEN
        RETURN NEW;
      END IF;

      SELECT COUNT(*) INTO v_current
      FROM students
      WHERE school_id = NEW.school_id
        AND status = 'enrolled'
        AND id <> NEW.id;

      IF v_current >= v_limit THEN
        RAISE EXCEPTION
          'Student limit of % reached for this school''s subscription plan. Please upgrade your plan.',
          v_limit;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.reactivate_school(
  p_school_id  UUID,
  p_grace_days INTEGER DEFAULT 7
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE schools SET is_online = true, updated_at = NOW() WHERE id = p_school_id;

  UPDATE subscriptions
  SET
    status               = 'grace',
    expires_at           = NOW() + (p_grace_days || ' days')::INTERVAL,
    grace_days_remaining = p_grace_days,
    suspended_at         = NULL,
    suspension_reason    = NULL
  WHERE school_id = p_school_id
    AND status    = 'suspended';
END;
$$;

CREATE OR REPLACE FUNCTION public.suspend_school(
  p_school_id UUID,
  p_reason    TEXT DEFAULT 'Subscription expired'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE schools SET is_online = false, updated_at = NOW() WHERE id = p_school_id;

  UPDATE subscriptions
  SET
    status            = 'suspended',
    suspended_at      = NOW(),
    suspension_reason = p_reason
  WHERE school_id = p_school_id
    AND status    IN ('active', 'trial', 'grace');
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_referral_notify()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM notify_school_roles(
    NEW.school_id,
    ARRAY['dean_of_students'],
    'new_referral',
    'New Teacher Referral',
    'A teacher has submitted a referral for a student.',
    '/dean/referrals'
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_incident_notify()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM notify_school_roles(
    NEW.school_id,
    ARRAY['dean_of_students'],
    'new_incident',
    'New Incident Reported',
    'A disciplinary incident has been logged and requires attention.',
    '/dean/incidents'
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_student_usage(p_school_id UUID)
RETURNS TABLE(enrolled INTEGER, plan_limit INTEGER, remaining INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit INTEGER;
  v_count INTEGER;
BEGIN
  SELECT sp.student_limit INTO v_limit
  FROM subscriptions sub
  JOIN subscription_plans sp ON sp.id = sub.plan_id
  WHERE sub.school_id = p_school_id
    AND sub.status IN ('active', 'trial', 'grace')
  ORDER BY sub.created_at DESC
  LIMIT 1;

  SELECT COUNT(*)::INTEGER INTO v_count
  FROM students
  WHERE school_id = p_school_id AND status = 'enrolled';

  RETURN QUERY SELECT v_count, COALESCE(v_limit, 999999), COALESCE(v_limit, 999999) - v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.store_otp(
  p_email      VARCHAR,
  p_otp_code   VARCHAR,
  p_otp_hash   VARCHAR,
  p_expires_at TIMESTAMP WITH TIME ZONE
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO email_verifications (email, otp_code, otp_hash, expires_at, attempts)
  VALUES (p_email, p_otp_code, p_otp_hash, p_expires_at, 0)
  ON CONFLICT (email) DO UPDATE SET
    otp_code    = EXCLUDED.otp_code,
    otp_hash    = EXCLUDED.otp_hash,
    expires_at  = EXCLUDED.expires_at,
    attempts    = 0,
    is_verified = false,
    verified_at = NULL,
    created_at  = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.verify_otp(
  p_email    VARCHAR,
  p_otp_code VARCHAR
)
RETURNS TABLE(success BOOLEAN, message TEXT, is_expired BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_record RECORD;
  v_now    TIMESTAMP WITH TIME ZONE;
BEGIN
  v_now := now();

  SELECT * INTO v_record FROM email_verifications
  WHERE email = p_email
  LIMIT 1;

  IF v_record IS NULL THEN
    RETURN QUERY SELECT false, 'No verification found for this email'::TEXT, false::BOOLEAN;
    RETURN;
  END IF;

  IF v_now > v_record.expires_at THEN
    UPDATE email_verifications SET attempts = attempts + 1 WHERE email = p_email;
    RETURN QUERY SELECT false, 'OTP has expired. Please request a new one.'::TEXT, true::BOOLEAN;
    RETURN;
  END IF;

  IF v_record.attempts >= 10 THEN
    RETURN QUERY SELECT false, 'Too many failed attempts. Please request a new OTP.'::TEXT, false::BOOLEAN;
    RETURN;
  END IF;

  IF v_record.otp_code != p_otp_code THEN
    UPDATE email_verifications SET attempts = attempts + 1 WHERE email = p_email;
    RETURN QUERY SELECT false, 'Incorrect OTP code. Please try again.'::TEXT, false::BOOLEAN;
    RETURN;
  END IF;

  UPDATE email_verifications
  SET is_verified = true, verified_at = v_now
  WHERE email = p_email;

  RETURN QUERY SELECT true, 'Email verified successfully'::TEXT, false::BOOLEAN;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_email_verified(p_email VARCHAR)
RETURNS TABLE(verified BOOLEAN, verified_at TIMESTAMP WITH TIME ZONE)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT ev.is_verified, ev.verified_at
  FROM email_verifications ev
  WHERE ev.email = p_email
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false::BOOLEAN, NULL::TIMESTAMP WITH TIME ZONE;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.cleanup_expired_otps()
RETURNS TABLE(deleted_count INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM email_verifications
  WHERE expires_at < now() AND is_verified = false;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN QUERY SELECT v_deleted;
END;
$$;

NOTIFY pgrst, 'reload schema';
