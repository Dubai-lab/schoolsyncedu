-- ============================================================
-- Migration 045: Dean of Students System
-- Run this in Supabase SQL editor.
-- Safe to re-run: drops existing tables/policies first.
-- ============================================================

-- Drop tables in reverse dependency order (CASCADE handles FK refs)
DROP TABLE IF EXISTS counselor_referrals      CASCADE;
DROP TABLE IF EXISTS student_welfare_flags    CASCADE;
DROP TABLE IF EXISTS parent_meetings          CASCADE;
DROP TABLE IF EXISTS suspensions              CASCADE;
DROP TABLE IF EXISTS teacher_referrals        CASCADE;
DROP TABLE IF EXISTS student_incidents        CASCADE;

-- ==================== STUDENT INCIDENTS ====================

CREATE TABLE student_incidents (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id       UUID        NOT NULL REFERENCES schools(id)   ON DELETE CASCADE,
  student_id      UUID        NOT NULL REFERENCES students(id)  ON DELETE CASCADE,
  reported_by     UUID                 REFERENCES users(id)     ON DELETE SET NULL,
  incident_type   TEXT        NOT NULL,
  description     TEXT        NOT NULL,
  incident_date   DATE        NOT NULL DEFAULT CURRENT_DATE,
  action_taken    TEXT        NOT NULL DEFAULT 'none',
  status          TEXT        NOT NULL DEFAULT 'open',
  dean_notes      TEXT,
  resolved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE student_incidents ENABLE ROW LEVEL SECURITY;

CREATE POLICY incidents_tenant ON student_incidents
  FOR ALL
  USING  (school_id = auth_school_id() OR is_super_admin())
  WITH CHECK (school_id = auth_school_id() OR is_super_admin());

CREATE INDEX idx_incidents_school  ON student_incidents(school_id);
CREATE INDEX idx_incidents_student ON student_incidents(student_id);
CREATE INDEX idx_incidents_date    ON student_incidents(incident_date DESC);
CREATE INDEX idx_incidents_status  ON student_incidents(status);

-- ==================== TEACHER REFERRALS ====================

CREATE TABLE teacher_referrals (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id   UUID        NOT NULL REFERENCES schools(id)            ON DELETE CASCADE,
  student_id  UUID        NOT NULL REFERENCES students(id)           ON DELETE CASCADE,
  teacher_id  UUID        NOT NULL REFERENCES users(id)              ON DELETE CASCADE,
  reason      TEXT        NOT NULL,
  details     TEXT,
  status      TEXT        NOT NULL DEFAULT 'pending',
  dean_notes  TEXT,
  incident_id UUID                 REFERENCES student_incidents(id)  ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE teacher_referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY referrals_tenant ON teacher_referrals
  FOR ALL
  USING  (school_id = auth_school_id() OR is_super_admin())
  WITH CHECK (school_id = auth_school_id() OR is_super_admin());

CREATE INDEX idx_referrals_school  ON teacher_referrals(school_id);
CREATE INDEX idx_referrals_student ON teacher_referrals(student_id);
CREATE INDEX idx_referrals_status  ON teacher_referrals(status);

-- ==================== SUSPENSIONS ====================

CREATE TABLE suspensions (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id           UUID        NOT NULL REFERENCES schools(id)            ON DELETE CASCADE,
  student_id          UUID        NOT NULL REFERENCES students(id)           ON DELETE CASCADE,
  incident_id         UUID                 REFERENCES student_incidents(id)  ON DELETE SET NULL,
  issued_by           UUID                 REFERENCES users(id)              ON DELETE SET NULL,
  start_date          DATE        NOT NULL,
  end_date            DATE        NOT NULL,
  reason              TEXT        NOT NULL,
  parent_notified     BOOLEAN     NOT NULL DEFAULT false,
  parent_notified_at  TIMESTAMPTZ,
  reinstated_at       TIMESTAMPTZ,
  reinstatement_notes TEXT,
  status              TEXT        NOT NULL DEFAULT 'active',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE suspensions ENABLE ROW LEVEL SECURITY;

CREATE POLICY suspensions_tenant ON suspensions
  FOR ALL
  USING  (school_id = auth_school_id() OR is_super_admin())
  WITH CHECK (school_id = auth_school_id() OR is_super_admin());

CREATE INDEX idx_suspensions_school  ON suspensions(school_id);
CREATE INDEX idx_suspensions_student ON suspensions(student_id);
CREATE INDEX idx_suspensions_status  ON suspensions(status);

-- ==================== PARENT MEETINGS ====================

CREATE TABLE parent_meetings (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id       UUID        NOT NULL REFERENCES schools(id)            ON DELETE CASCADE,
  student_id      UUID        NOT NULL REFERENCES students(id)           ON DELETE CASCADE,
  dean_id         UUID                 REFERENCES users(id)              ON DELETE SET NULL,
  incident_id     UUID                 REFERENCES student_incidents(id)  ON DELETE SET NULL,
  scheduled_at    TIMESTAMPTZ NOT NULL,
  purpose         TEXT        NOT NULL,
  outcome         TEXT,
  parent_attended BOOLEAN              DEFAULT false,
  follow_up       TEXT,
  status          TEXT        NOT NULL DEFAULT 'scheduled',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE parent_meetings ENABLE ROW LEVEL SECURITY;

CREATE POLICY meetings_tenant ON parent_meetings
  FOR ALL
  USING  (school_id = auth_school_id() OR is_super_admin())
  WITH CHECK (school_id = auth_school_id() OR is_super_admin());

CREATE INDEX idx_meetings_school    ON parent_meetings(school_id);
CREATE INDEX idx_meetings_student   ON parent_meetings(student_id);
CREATE INDEX idx_meetings_scheduled ON parent_meetings(scheduled_at);

-- ==================== STUDENT WELFARE FLAGS ====================

CREATE TABLE student_welfare_flags (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id   UUID        NOT NULL REFERENCES schools(id)   ON DELETE CASCADE,
  student_id  UUID        NOT NULL REFERENCES students(id)  ON DELETE CASCADE,
  flagged_by  UUID                 REFERENCES users(id)     ON DELETE SET NULL,
  risk_type   TEXT        NOT NULL,
  notes       TEXT        NOT NULL,
  action_plan TEXT,
  review_date DATE,
  status      TEXT        NOT NULL DEFAULT 'active',
  resolved_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE student_welfare_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY welfare_tenant ON student_welfare_flags
  FOR ALL
  USING  (school_id = auth_school_id() OR is_super_admin())
  WITH CHECK (school_id = auth_school_id() OR is_super_admin());

CREATE INDEX idx_welfare_school  ON student_welfare_flags(school_id);
CREATE INDEX idx_welfare_student ON student_welfare_flags(student_id);
CREATE INDEX idx_welfare_status  ON student_welfare_flags(status);

-- ==================== COUNSELOR REFERRALS ====================

CREATE TABLE counselor_referrals (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id         UUID        NOT NULL REFERENCES schools(id)            ON DELETE CASCADE,
  student_id        UUID        NOT NULL REFERENCES students(id)           ON DELETE CASCADE,
  referred_by       UUID                 REFERENCES users(id)              ON DELETE SET NULL,
  incident_id       UUID                 REFERENCES student_incidents(id)  ON DELETE SET NULL,
  reason            TEXT        NOT NULL,
  urgency           TEXT        NOT NULL DEFAULT 'normal',
  status            TEXT        NOT NULL DEFAULT 'pending',
  counselor_outcome TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE counselor_referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY counselor_refs_tenant ON counselor_referrals
  FOR ALL
  USING  (school_id = auth_school_id() OR is_super_admin())
  WITH CHECK (school_id = auth_school_id() OR is_super_admin());

CREATE INDEX idx_counselor_refs_school  ON counselor_referrals(school_id);
CREATE INDEX idx_counselor_refs_student ON counselor_referrals(student_id);

-- ==================== DEAN DASHBOARD STATS FUNCTION ====================

CREATE OR REPLACE FUNCTION get_dean_dashboard_stats(p_school_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_build_object(
    'total_incidents_week',
      (SELECT COUNT(*) FROM public.student_incidents
       WHERE school_id = p_school_id
         AND incident_date >= CURRENT_DATE - INTERVAL '7 days'),
    'open_incidents',
      (SELECT COUNT(*) FROM public.student_incidents
       WHERE school_id = p_school_id AND status = 'open'),
    'pending_referrals',
      (SELECT COUNT(*) FROM public.teacher_referrals
       WHERE school_id = p_school_id AND status = 'pending'),
    'active_suspensions',
      (SELECT COUNT(*) FROM public.suspensions
       WHERE school_id = p_school_id AND status = 'active'
         AND end_date >= CURRENT_DATE),
    'upcoming_meetings',
      (SELECT COUNT(*) FROM public.parent_meetings
       WHERE school_id = p_school_id AND status = 'scheduled'
         AND scheduled_at >= now()),
    'welfare_flags',
      (SELECT COUNT(*) FROM public.student_welfare_flags
       WHERE school_id = p_school_id AND status = 'active'),
    'pending_counselor_referrals',
      (SELECT COUNT(*) FROM public.counselor_referrals
       WHERE school_id = p_school_id AND status = 'pending')
  ) INTO v_result;

  RETURN v_result;
END;
$$;
