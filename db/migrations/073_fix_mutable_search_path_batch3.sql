-- Migration 073: Fix mutable search_path warnings — batch 3
-- Adds SET search_path = public to 3 SQL functions flagged by Supabase Advisor.

CREATE OR REPLACE FUNCTION public.get_student_full_name(student_id UUID)
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT first_name || ' ' || last_name FROM students WHERE id = $1;
$$;

CREATE OR REPLACE FUNCTION public.get_current_term(school_id UUID)
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT id FROM academic_calendar
  WHERE school_id = $1
    AND start_date <= CURRENT_DATE
    AND end_date   >= CURRENT_DATE
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.has_unpaid_fees(p_student_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS(
    SELECT 1 FROM student_fees
    WHERE student_id = p_student_id AND balance > 0
  );
$$;

NOTIFY pgrst, 'reload schema';
