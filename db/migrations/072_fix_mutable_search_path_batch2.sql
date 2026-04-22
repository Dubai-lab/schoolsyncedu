-- Migration 072: Fix mutable search_path warnings — batch 2
-- Adds SET search_path = public to 3 SQL functions flagged by Supabase Advisor.

CREATE OR REPLACE FUNCTION public.get_pending_letters_count(p_user_id UUID)
RETURNS INTEGER
LANGUAGE SQL
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT COUNT(*)::INTEGER FROM letter_instances
  WHERE status = 'pending_approval'::letter_instance_status
    AND (approved_by = p_user_id OR created_by = p_user_id);
$$;

CREATE OR REPLACE FUNCTION public.get_overdue_books_count(p_student_id UUID)
RETURNS INTEGER
LANGUAGE SQL
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT COUNT(*)::INTEGER FROM book_checkouts
  WHERE student_id  = p_student_id
    AND is_returned = FALSE
    AND due_date    < CURRENT_DATE;
$$;

CREATE OR REPLACE FUNCTION public.is_student_enrolled(p_student_id UUID, p_class_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS(
    SELECT 1 FROM class_assignments
    WHERE student_id = p_student_id
      AND class_id   = p_class_id
      AND removed_at IS NULL
  );
$$;

NOTIFY pgrst, 'reload schema';
