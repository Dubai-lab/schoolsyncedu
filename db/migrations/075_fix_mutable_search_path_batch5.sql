-- Migration 075: Fix mutable search_path warnings — batch 5
-- Adds SET search_path = public to 5 trigger functions flagged by Supabase Advisor.

CREATE OR REPLACE FUNCTION public.set_payment_config_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.touch_school_email_config()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_grade_submitted_notify()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'submitted' AND (OLD.status IS DISTINCT FROM 'submitted') THEN
    PERFORM notify_school_roles(
      NEW.school_id,
      ARRAY['principal', 'vice_principal'],
      'grade_approval',
      'Grades Pending Approval',
      'New grades have been submitted and are awaiting your approval.',
      '/grades/approval'
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_letter_approval_notify()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'pending_approval' AND (OLD.status IS DISTINCT FROM 'pending_approval') THEN
    PERFORM notify_school_roles(
      NEW.school_id,
      ARRAY['principal', 'vice_principal'],
      'letter_approval',
      'Letter Awaiting Approval',
      'A letter has been submitted and is waiting for your sign-off.',
      '/letters/approvals'
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_application_notify()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM notify_school_roles(
    NEW.school_id,
    ARRAY['registrar'],
    'new_application',
    'New Student Application',
    'A new application has been received and needs review.',
    '/registrar/applications'
  );
  RETURN NEW;
END;
$$;

NOTIFY pgrst, 'reload schema';
