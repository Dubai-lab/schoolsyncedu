-- ============================================================
-- Migration 049: Database-level enforcement of subscription student limit
-- This is a hard guard that fires even if the app-layer check is bypassed.
-- ============================================================

CREATE OR REPLACE FUNCTION check_student_limit()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_limit     INTEGER;
  v_current   INTEGER;
BEGIN
  -- Only enforce on new enrolled students (INSERT or status change to 'enrolled')
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.status = 'enrolled' AND OLD.status <> 'enrolled') THEN
    IF NEW.status = 'enrolled' THEN
      -- Get the student limit from the school's active subscription plan
      SELECT sp.student_limit INTO v_limit
      FROM subscriptions sub
      JOIN subscription_plans sp ON sp.id = sub.plan_id
      WHERE sub.school_id = NEW.school_id
        AND sub.status IN ('active', 'trial', 'grace')
      ORDER BY sub.created_at DESC
      LIMIT 1;

      -- If no active subscription found, allow (trial/setup period)
      IF v_limit IS NULL THEN
        RETURN NEW;
      END IF;

      -- Count currently enrolled students
      SELECT COUNT(*) INTO v_current
      FROM students
      WHERE school_id = NEW.school_id
        AND status = 'enrolled'
        AND id <> NEW.id;  -- exclude the row being inserted

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

-- Attach trigger to students table
DROP TRIGGER IF EXISTS trg_check_student_limit ON students;
CREATE TRIGGER trg_check_student_limit
  BEFORE INSERT OR UPDATE OF status ON students
  FOR EACH ROW
  EXECUTE FUNCTION check_student_limit();

-- Helper function: get a school's current enrolled student count vs their plan limit
CREATE OR REPLACE FUNCTION get_student_usage(p_school_id UUID)
RETURNS TABLE(enrolled INTEGER, plan_limit INTEGER, remaining INTEGER)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_limit  INTEGER;
  v_count  INTEGER;
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
