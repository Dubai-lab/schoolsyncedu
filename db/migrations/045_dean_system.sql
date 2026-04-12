-- ============================================================
-- Migration 045: Dean of Students System
-- Tables: student_incidents, teacher_referrals, suspensions,
--         parent_meetings, student_welfare_flags
-- ============================================================

-- ==================== STUDENT INCIDENTS ====================

CREATE TABLE IF NOT EXISTS student_incidents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id       UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id      UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  reported_by     UUID REFERENCES users(id) ON DELETE SET NULL,
  incident_type   TEXT NOT NULL,
  -- types: tardiness, truancy, disruptive_behavior, fighting, vandalism,
  --        bullying, theft, cheating, insubordination, other
  description     TEXT NOT NULL,
  incident_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  action_taken    TEXT NOT NULL DEFAULT 'none',
  -- actions: none, verbal_warning, written_warning, detention,
  --          parent_call, suspension, expulsion_recommendation
  status          TEXT NOT NULL DEFAULT 'open',
  -- statuses: open, under_review, resolved
  dean_notes      TEXT,
  resolved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE student_incidents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "school_scoped_incidents" ON student_incidents
  USING (school_id = (SELECT school_id FROM users WHERE id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_incidents_school ON student_incidents(school_id);
CREATE INDEX IF NOT EXISTS idx_incidents_student ON student_incidents(student_id);
CREATE INDEX IF NOT EXISTS idx_incidents_date ON student_incidents(incident_date DESC);
CREATE INDEX IF NOT EXISTS idx_incidents_status ON student_incidents(status);

-- ==================== TEACHER REFERRALS ====================

CREATE TABLE IF NOT EXISTS teacher_referrals (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id    UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id   UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  teacher_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason       TEXT NOT NULL,
  details      TEXT,
  status       TEXT NOT NULL DEFAULT 'pending',
  -- statuses: pending, reviewed, resolved, dismissed
  dean_notes   TEXT,
  incident_id  UUID REFERENCES student_incidents(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE teacher_referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "school_scoped_referrals" ON teacher_referrals
  USING (school_id = (SELECT school_id FROM users WHERE id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_referrals_school ON teacher_referrals(school_id);
CREATE INDEX IF NOT EXISTS idx_referrals_student ON teacher_referrals(student_id);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON teacher_referrals(status);

-- ==================== SUSPENSIONS ====================

CREATE TABLE IF NOT EXISTS suspensions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id        UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id       UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  incident_id      UUID REFERENCES student_incidents(id) ON DELETE SET NULL,
  issued_by        UUID REFERENCES users(id) ON DELETE SET NULL,
  start_date       DATE NOT NULL,
  end_date         DATE NOT NULL,
  reason           TEXT NOT NULL,
  parent_notified  BOOLEAN NOT NULL DEFAULT false,
  parent_notified_at TIMESTAMPTZ,
  reinstated_at    TIMESTAMPTZ,
  reinstatement_notes TEXT,
  status           TEXT NOT NULL DEFAULT 'active',
  -- statuses: active, completed, reinstated_early
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE suspensions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "school_scoped_suspensions" ON suspensions
  USING (school_id = (SELECT school_id FROM users WHERE id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_suspensions_school ON suspensions(school_id);
CREATE INDEX IF NOT EXISTS idx_suspensions_student ON suspensions(student_id);
CREATE INDEX IF NOT EXISTS idx_suspensions_status ON suspensions(status);

-- ==================== PARENT MEETINGS ====================

CREATE TABLE IF NOT EXISTS parent_meetings (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id      UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id     UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  dean_id        UUID REFERENCES users(id) ON DELETE SET NULL,
  incident_id    UUID REFERENCES student_incidents(id) ON DELETE SET NULL,
  scheduled_at   TIMESTAMPTZ NOT NULL,
  purpose        TEXT NOT NULL,
  outcome        TEXT,
  parent_attended BOOLEAN DEFAULT false,
  follow_up      TEXT,
  status         TEXT NOT NULL DEFAULT 'scheduled',
  -- statuses: scheduled, completed, cancelled, no_show
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE parent_meetings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "school_scoped_meetings" ON parent_meetings
  USING (school_id = (SELECT school_id FROM users WHERE id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_meetings_school ON parent_meetings(school_id);
CREATE INDEX IF NOT EXISTS idx_meetings_student ON parent_meetings(student_id);
CREATE INDEX IF NOT EXISTS idx_meetings_scheduled ON parent_meetings(scheduled_at);

-- ==================== STUDENT WELFARE FLAGS ====================

CREATE TABLE IF NOT EXISTS student_welfare_flags (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id    UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id   UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  flagged_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  risk_type    TEXT NOT NULL,
  -- types: academic, behavioral, social, family, health, other
  notes        TEXT NOT NULL,
  action_plan  TEXT,
  review_date  DATE,
  status       TEXT NOT NULL DEFAULT 'active',
  -- statuses: active, monitoring, resolved
  resolved_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (school_id, student_id, risk_type, status)
);

ALTER TABLE student_welfare_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "school_scoped_welfare" ON student_welfare_flags
  USING (school_id = (SELECT school_id FROM users WHERE id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_welfare_school ON student_welfare_flags(school_id);
CREATE INDEX IF NOT EXISTS idx_welfare_student ON student_welfare_flags(student_id);
CREATE INDEX IF NOT EXISTS idx_welfare_status ON student_welfare_flags(status);

-- ==================== COUNSELOR REFERRALS ====================

CREATE TABLE IF NOT EXISTS counselor_referrals (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id     UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id    UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  referred_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  incident_id   UUID REFERENCES student_incidents(id) ON DELETE SET NULL,
  reason        TEXT NOT NULL,
  urgency       TEXT NOT NULL DEFAULT 'normal',
  -- urgency: low, normal, high, urgent
  status        TEXT NOT NULL DEFAULT 'pending',
  -- statuses: pending, in_session, closed
  counselor_outcome TEXT,  -- visible to dean (not detailed session notes)
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE counselor_referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "school_scoped_counselor_referrals" ON counselor_referrals
  USING (school_id = (SELECT school_id FROM users WHERE id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_counselor_refs_school ON counselor_referrals(school_id);
CREATE INDEX IF NOT EXISTS idx_counselor_refs_student ON counselor_referrals(student_id);

-- ==================== HELPER: get_dean_dashboard_stats ====================

CREATE OR REPLACE FUNCTION get_dean_dashboard_stats(p_school_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_build_object(
    'total_incidents_week',
      (SELECT COUNT(*) FROM student_incidents
       WHERE school_id = p_school_id
         AND incident_date >= CURRENT_DATE - INTERVAL '7 days'),
    'open_incidents',
      (SELECT COUNT(*) FROM student_incidents
       WHERE school_id = p_school_id AND status = 'open'),
    'pending_referrals',
      (SELECT COUNT(*) FROM teacher_referrals
       WHERE school_id = p_school_id AND status = 'pending'),
    'active_suspensions',
      (SELECT COUNT(*) FROM suspensions
       WHERE school_id = p_school_id AND status = 'active'
         AND end_date >= CURRENT_DATE),
    'upcoming_meetings',
      (SELECT COUNT(*) FROM parent_meetings
       WHERE school_id = p_school_id AND status = 'scheduled'
         AND scheduled_at >= now()),
    'welfare_flags',
      (SELECT COUNT(*) FROM student_welfare_flags
       WHERE school_id = p_school_id AND status = 'active'),
    'pending_counselor_referrals',
      (SELECT COUNT(*) FROM counselor_referrals
       WHERE school_id = p_school_id AND status = 'pending')
  ) INTO v_result;

  RETURN v_result;
END;
$$;
